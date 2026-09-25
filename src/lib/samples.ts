import type { SourceDocument } from "@/lib/types";
import { detectLanguage, extensionOf } from "@/lib/splitter/language";

export const TYPESCRIPT_SAMPLE = `/**
 * ForgeQueue — in-process job queue with retries, events, and an HTTP adapter.
 * Designed as a single file so Splitter Studio can carve it into modules.
 */

export type JobStatus = "pending" | "running" | "completed" | "failed" | "delayed";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type Job<T = unknown> = {
  id: string;
  name: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  result: unknown;
};

export type QueueOptions = {
  concurrency: number;
  pollIntervalMs: number;
  defaultMaxAttempts: number;
  backoffMs: number;
  name: string;
};

export type Logger = {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
};

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<unknown> | unknown;

export type QueueEvents = {
  "job:added": Job;
  "job:started": Job;
  "job:completed": Job;
  "job:failed": Job;
  "queue:idle": { name: string };
};

export class QueueError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QueueError";
    this.code = code;
  }
}

export class HandlerMissingError extends QueueError {
  constructor(jobName: string) {
    super("HANDLER_MISSING", \`No handler registered for job "\${jobName}"\`);
  }
}

export function createId(prefix = "job"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return \`\${prefix}_\${time}\${rand}\`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function now(): number {
  return Date.now();
}

export function computeBackoff(attempts: number, baseMs: number): number {
  const exp = Math.min(8, Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 80);
  return baseMs * 2 ** exp + jitter;
}

export function serializeJob(job: Job): JsonValue {
  return {
    id: job.id,
    name: job.name,
    payload: job.payload as JsonValue,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    result: (job.result ?? null) as JsonValue,
  };
}

export class ConsoleLogger implements Logger {
  constructor(private readonly scope: string) {}

  debug(message: string, extra?: Record<string, unknown>) {
    this.write("debug", message, extra);
  }

  info(message: string, extra?: Record<string, unknown>) {
    this.write("info", message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>) {
    this.write("warn", message, extra);
  }

  error(message: string, extra?: Record<string, unknown>) {
    this.write("error", message, extra);
  }

  private write(level: string, message: string, extra?: Record<string, unknown>) {
    const line = \`[\${this.scope}] \${level.toUpperCase()} \${message}\`;
    if (level === "error") console.error(line, extra ?? "");
    else if (level === "warn") console.warn(line, extra ?? "");
    else console.log(line, extra ?? "");
  }
}

type Listener<T> = (payload: T) => void;

export class EventBus<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) listener(payload);
  }
}

export class InMemoryJobStore {
  private jobs = new Map<string, Job>();

  insert(job: Job): Job {
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<Job>): Job {
    const current = this.jobs.get(id);
    if (!current) throw new QueueError("NOT_FOUND", \`Job \${id} not found\`);
    const next = { ...current, ...patch };
    this.jobs.set(id, next);
    return next;
  }

  due(at: number, limit: number): Job[] {
    return [...this.jobs.values()]
      .filter((job) => (job.status === "pending" || job.status === "delayed") && job.runAt <= at)
      .sort((a, b) => a.runAt - b.runAt)
      .slice(0, limit);
  }

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => a.runAt - b.runAt);
  }

  stats() {
    const all = this.list();
    const count = (status: JobStatus) => all.filter((job) => job.status === status).length;
    return {
      total: all.length,
      pending: count("pending"),
      running: count("running"),
      completed: count("completed"),
      failed: count("failed"),
      delayed: count("delayed"),
    };
  }
}

export class Worker {
  private active = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly store: InMemoryJobStore,
    private readonly handlers: Map<string, JobHandler>,
    private readonly events: EventBus<QueueEvents>,
    private readonly logger: Logger,
    private readonly options: QueueOptions,
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollIntervalMs);
    this.logger.info("worker started", { concurrency: this.options.concurrency });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.logger.info("worker stopped");
  }

  private async tick() {
    const available = this.options.concurrency - this.active;
    if (available <= 0) return;
    const batch = this.store.due(now(), available);
    if (batch.length === 0 && this.active === 0) {
      this.events.emit("queue:idle", { name: this.options.name });
      return;
    }
    for (const job of batch) {
      void this.run(job);
    }
  }

  private async run(job: Job) {
    this.active += 1;
    const started = this.store.update(job.id, { status: "running", startedAt: now(), attempts: job.attempts + 1 });
    this.events.emit("job:started", started);
    const handler = this.handlers.get(job.name);
    if (!handler) {
      const failed = this.store.update(job.id, {
        status: "failed",
        finishedAt: now(),
        error: new HandlerMissingError(job.name).message,
      });
      this.events.emit("job:failed", failed);
      this.active -= 1;
      return;
    }
    try {
      const result = await handler(started);
      const completed = this.store.update(job.id, {
        status: "completed",
        finishedAt: now(),
        result,
        error: null,
      });
      this.events.emit("job:completed", completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (started.attempts >= started.maxAttempts) {
        const failed = this.store.update(job.id, { status: "failed", finishedAt: now(), error: message });
        this.logger.error("job failed permanently", { id: job.id, message });
        this.events.emit("job:failed", failed);
      } else {
        const delay = computeBackoff(started.attempts, this.options.backoffMs);
        const delayed = this.store.update(job.id, {
          status: "delayed",
          runAt: now() + delay,
          error: message,
        });
        this.logger.warn("job retry scheduled", { id: job.id, delay });
        this.events.emit("job:failed", delayed);
      }
    } finally {
      this.active -= 1;
    }
  }
}

export class ForgeQueue {
  private readonly store = new InMemoryJobStore();
  private readonly handlers = new Map<string, JobHandler>();
  readonly events = new EventBus<QueueEvents>();
  private readonly worker: Worker;
  private readonly logger: Logger;
  readonly options: QueueOptions;

  constructor(options: Partial<QueueOptions> = {}, logger?: Logger) {
    this.options = {
      concurrency: 2,
      pollIntervalMs: 40,
      defaultMaxAttempts: 3,
      backoffMs: 120,
      name: "forge",
      ...options,
    };
    this.logger = logger ?? new ConsoleLogger(this.options.name);
    this.worker = new Worker(this.store, this.handlers, this.events, this.logger, this.options);
  }

  handle<T>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler);
    return this;
  }

  enqueue<T>(name: string, payload: T, extras?: { delayMs?: number; maxAttempts?: number }): Job<T> {
    const job: Job<T> = {
      id: createId("job"),
      name,
      payload,
      status: extras?.delayMs ? "delayed" : "pending",
      attempts: 0,
      maxAttempts: extras?.maxAttempts ?? this.options.defaultMaxAttempts,
      runAt: now() + (extras?.delayMs ?? 0),
      startedAt: null,
      finishedAt: null,
      error: null,
      result: null,
    };
    this.store.insert(job);
    this.events.emit("job:added", job);
    return job;
  }

  get(id: string) {
    return this.store.get(id);
  }

  stats() {
    return this.store.stats();
  }

  start() {
    this.worker.start();
    return this;
  }

  stop() {
    this.worker.stop();
    return this;
  }
}

export type HttpAdapterOptions = {
  prefix: string;
};

export function createHttpAdapter(queue: ForgeQueue, options: HttpAdapterOptions = { prefix: "/queue" }) {
  const prefix = options.prefix.replace(/\\/$/, "");
  return async function handleRequest(method: string, url: string, body?: unknown) {
    const path = url.split("?")[0] ?? url;
    if (method === "GET" && path === \`\${prefix}/stats\`) return queue.stats();
    if (method === "GET" && path.startsWith(\`\${prefix}/jobs/\`)) {
      const id = path.slice(\`\${prefix}/jobs/\`.length);
      return queue.get(id) ?? { error: "not_found" };
    }
    if (method === "POST" && path === \`\${prefix}/jobs\`) {
      const input = body as { name?: string; payload?: unknown; delayMs?: number };
      if (!input?.name) return { error: "name_required" };
      return queue.enqueue(input.name, input.payload, { delayMs: input.delayMs });
    }
    return { error: "not_found" };
  };
}

export function createForgeQueue(options?: Partial<QueueOptions>) {
  return new ForgeQueue(options);
}

export default createForgeQueue;
`;

export const PYTHON_SAMPLE = `"""Batch media pipeline: extract, transform, load, and report."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Iterator


@dataclass
class Record:
    id: str
    source: str
    payload: dict
    tags: list[str] = field(default_factory=list)


class ExtractError(RuntimeError):
    pass


class TransformError(RuntimeError):
    pass


def read_glob(root: Path, pattern: str) -> Iterator[Path]:
    for path in sorted(root.glob(pattern)):
        if path.is_file():
            yield path


def parse_line(raw: str, source: str) -> Record:
    parts = [part.strip() for part in raw.split("|")]
    if len(parts) < 2:
        raise ExtractError(f"Malformed line in {source}: {raw!r}")
    key, *rest = parts
    payload = {"text": " ".join(rest)}
    return Record(id=key, source=source, payload=payload)


class FileExtractor:
    def __init__(self, root: Path, pattern: str = "*.txt") -> None:
        self.root = root
        self.pattern = pattern

    def run(self) -> Iterator[Record]:
        for path in read_glob(self.root, self.pattern):
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip() or line.startswith("#"):
                    continue
                yield parse_line(line, str(path))


def lowercase_text(record: Record) -> Record:
    text = str(record.payload.get("text", "")).lower()
    record.payload["text"] = text
    return record


def tag_keywords(record: Record, keywords: Iterable[str]) -> Record:
    text = str(record.payload.get("text", ""))
    for word in keywords:
        if word in text and word not in record.tags:
            record.tags.append(word)
    return record


class Transformer:
    def __init__(self) -> None:
        self.steps: list[Callable[[Record], Record]] = []

    def use(self, step: Callable[[Record], Record]) -> "Transformer":
        self.steps.append(step)
        return self

    def run(self, records: Iterable[Record]) -> Iterator[Record]:
        for record in records:
            current = record
            for step in self.steps:
                current = step(current)
            yield current


class MemoryLoader:
    def __init__(self) -> None:
        self.rows: list[Record] = []

    def write(self, records: Iterable[Record]) -> int:
        count = 0
        for record in records:
            self.rows.append(record)
            count += 1
        return count

    def by_tag(self, tag: str) -> list[Record]:
        return [row for row in self.rows if tag in row.tags]


def summarize(loader: MemoryLoader) -> dict:
    tags: dict[str, int] = {}
    for row in loader.rows:
        for tag in row.tags:
            tags[tag] = tags.get(tag, 0) + 1
    return {"records": len(loader.rows), "tags": tags}


def build_default_pipeline(root: Path) -> tuple[FileExtractor, Transformer, MemoryLoader]:
    extractor = FileExtractor(root)
    transformer = Transformer().use(lowercase_text).use(lambda rec: tag_keywords(rec, ["error", "warn", "ok"]))
    loader = MemoryLoader()
    return extractor, transformer, loader


def run_pipeline(root: Path) -> dict:
    extractor, transformer, loader = build_default_pipeline(root)
    written = loader.write(transformer.run(extractor.run()))
    report = summarize(loader)
    report["written"] = written
    return report
`;

export const JAVASCRIPT_SAMPLE = `/**
 * Mini renderer — hyperscript, a tiny diff, and a store.
 */

export function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter((child) => child !== false && child !== null && child !== undefined);
  return { type, props: props || {}, children: flat };
}

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get() {
      return state;
    },
    set(next) {
      state = typeof next === "function" ? next(state) : next;
      listeners.forEach((fn) => fn(state));
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function setProp(el, key, value) {
  if (key === "className") el.setAttribute("class", value ?? "");
  else if (key === "style" && value && typeof value === "object") Object.assign(el.style, value);
  else if (key.startsWith("on") && typeof value === "function") el[key.toLowerCase()] = value;
  else if (value === false || value === null || value === undefined) el.removeAttribute(key);
  else el.setAttribute(key, String(value));
}

export function createElement(vnode) {
  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode));
  }
  const el = document.createElement(vnode.type);
  Object.entries(vnode.props).forEach(([key, value]) => setProp(el, key, value));
  vnode.children.forEach((child) => el.appendChild(createElement(child)));
  return el;
}

function changed(a, b) {
  return typeof a !== typeof b || a.type !== b.type || (typeof a === "string" && a !== b);
}

export function patch(parent, newNode, oldNode, index = 0) {
  if (!oldNode) {
    parent.appendChild(createElement(newNode));
    return;
  }
  if (!newNode) {
    if (parent.childNodes[index]) parent.removeChild(parent.childNodes[index]);
    return;
  }
  if (changed(newNode, oldNode)) {
    parent.replaceChild(createElement(newNode), parent.childNodes[index]);
    return;
  }
  if (typeof newNode === "string") return;
  const max = Math.max(newNode.children.length, oldNode.children.length);
  for (let i = 0; i < max; i += 1) {
    patch(parent.childNodes[index], newNode.children[i], oldNode.children[i], i);
  }
}

export function mount(root, view, store) {
  let current = view(store.get());
  root.appendChild(createElement(current));
  return store.subscribe((state) => {
    const next = view(state);
    patch(root, next, current, 0);
    current = next;
  });
}

export function CounterView(state) {
  return h("div", { className: "counter" },
    h("p", { className: "count" }, String(state.count)),
    h("button", { onClick: () => {} }, "Increment"),
  );
}

export default function createApp(root, initial = { count: 0 }) {
  const store = createStore(initial);
  const unmount = mount(root, CounterView, store);
  return { store, unmount, increment: () => store.set((s) => ({ count: s.count + 1 })) };
}
`;

export type SampleId = "typescript" | "python" | "javascript";

export const SAMPLES: Record<SampleId, { label: string; name: string; content: string }> = {
  typescript: { label: "TypeScript · ForgeQueue", name: "forge-queue.ts", content: TYPESCRIPT_SAMPLE },
  python: { label: "Python · Data pipeline", name: "pipeline.py", content: PYTHON_SAMPLE },
  javascript: { label: "JavaScript · Mini renderer", name: "mini-renderer.js", content: JAVASCRIPT_SAMPLE },
};

export function sourceFromSample(id: SampleId): SourceDocument {
  const sample = SAMPLES[id];
  return {
    name: sample.name,
    content: sample.content,
    language: detectLanguage(sample.name, sample.content),
    extension: extensionOf(sample.name),
  };
}

export function sourceFromFile(name: string, content: string): SourceDocument {
  return {
    name,
    content,
    language: detectLanguage(name, content),
    extension: extensionOf(name),
  };
}
