import { createServerFn } from "@tanstack/react-start";
import type { RefactorActionId } from "@/lib/types";

const ACTIONS: Record<RefactorActionId, { title: string; instruction: string }> = {
  "improve-names": {
    title: "Improve names",
    instruction: "Rename unclear symbols to precise, conventional names. Keep public APIs stable unless a name is misleading. Return the full updated file.",
  },
  "extract-helpers": {
    title: "Extract helpers",
    instruction: "Pull repeated or dense logic into well-named helper functions in the same file. Return the full updated file.",
  },
  "add-types": {
    title: "Add types",
    instruction: "Add or tighten types, interfaces, or annotations appropriate to the language. Do not change runtime behavior. Return the full updated file.",
  },
  "add-docs": {
    title: "Add documentation",
    instruction: "Add concise module and public-API documentation comments. No marketing language. Return the full updated file.",
  },
  "generate-tests": {
    title: "Generate tests",
    instruction: "Write a focused unit test file for the exports in this module. Return only the test file contents.",
  },
  simplify: {
    title: "Simplify logic",
    instruction: "Simplify control flow and remove redundancy while preserving behavior. Return the full updated file.",
  },
};

export const REFACTOR_ACTIONS = ACTIONS;

type RefactorInput = {
  action: RefactorActionId;
  filePath: string;
  content: string;
  language: string;
};

export const runRefactor = createServerFn({ method: "POST" })
  .validator((data: unknown): RefactorInput => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    const d = data as Record<string, unknown>;
    const action = d.action;
    if (typeof action !== "string" || !(action in ACTIONS)) throw new Error("Unknown action");
    if (typeof d.filePath !== "string" || typeof d.content !== "string" || typeof d.language !== "string") {
      throw new Error("Invalid payload");
    }
    return {
      action: action as RefactorActionId,
      filePath: d.filePath.slice(0, 240),
      content: d.content.slice(0, 12000),
      language: d.language.slice(0, 40),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not available in this environment." };
    }
    const spec = ACTIONS[data.action];
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1800,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a senior engineer inside Splitter Studio. Return ONLY the updated source code. No markdown fences, no commentary.",
          },
          {
            role: "user",
            content: `${spec.instruction}\n\nFile: ${data.filePath}\nLanguage: ${data.language}\n\n${data.content}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: `xAI API error ${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let text = body.choices?.[0]?.message?.content ?? "";
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    if (!text) return { ok: false as const, error: "The model returned an empty response." };
    return { ok: true as const, text, title: spec.title };
  });
