import type { ProjectFile, TreeNode } from "@/lib/types";
import { countLines, dirFromPath, fileNameFromPath, joinPath, splitPath } from "@/lib/utils";

export function filesToTree(files: ProjectFile[]): TreeNode[] {
  type Mutable = TreeNode & { children: Mutable[] };
  const root: Mutable[] = [];
  const folders = new Map<string, Mutable>();

  const ensureFolder = (path: string): Mutable[] => {
    if (!path) return root;
    const existing = folders.get(path);
    if (existing) return existing.children;
    const parentPath = dirFromPath(path);
    const siblings = ensureFolder(parentPath);
    const folder: Mutable = {
      id: `folder:${path}`,
      name: fileNameFromPath(path),
      path,
      type: "folder",
      children: [],
    };
    folders.set(path, folder);
    siblings.push(folder);
    siblings.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return folder.children;
  };

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const siblings = ensureFolder(dirFromPath(file.path));
    siblings.push({
      id: file.id,
      name: fileNameFromPath(file.path),
      path: file.path,
      type: "file",
      language: file.language,
      kind: file.kind,
      children: [],
    });
    siblings.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  return root;
}

export function listFolders(files: ProjectFile[]): string[] {
  const set = new Set<string>();
  for (const file of files) {
    const dir = dirFromPath(file.path);
    if (!dir) continue;
    const parts = dir.split("/");
    let acc = "";
    for (const part of parts) {
      acc = joinPath(acc, part);
      set.add(acc);
    }
  }
  return [...set].sort();
}

export type DiffLine = {
  type: "same" | "add" | "del";
  text: string;
};

export function unifiedDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = aLines[i] === bLines[j] ? (dp[i + 1]![j + 1] ?? 0) + 1 : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: "same", text: aLines[i]! });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      out.push({ type: "del", text: aLines[i]! });
      i += 1;
    } else {
      out.push({ type: "add", text: bLines[j]! });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ type: "del", text: aLines[i]! });
    i += 1;
  }
  while (j < m) {
    out.push({ type: "add", text: bLines[j]! });
    j += 1;
  }
  return out;
}

export function formatCode(content: string, path: string): string {
  if (path.endsWith(".json")) {
    try {
      return `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
    } catch {
      return content;
    }
  }
  const lines = content.replace(/\t/g, "  ").split("\n");
  let indent = 0;
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    const closers = (trimmed.match(/^[\}\]\)]+/) ?? [""])[0].length;
    indent = Math.max(0, indent - closers);
    if (trimmed.startsWith("}") || trimmed.startsWith("]") || trimmed.startsWith(")")) {
      /* already counted */
    } else if (/^[\}\]\)]/.test(trimmed)) {
      indent = Math.max(0, indent - 1);
    }
    const decrease = /^(\}|\]|\))/.test(trimmed) && !trimmed.includes("{");
    const level = decrease ? indent : indent;
    out.push(`${"  ".repeat(level)}${trimmed}`);
    const opens = (trimmed.match(/[\{\[\(]/g) ?? []).length;
    const closes = (trimmed.match(/[\}\]\)]/g) ?? []).length;
    indent = Math.max(0, indent + opens - closes);
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

export function projectAsText(files: ProjectFile[]): string {
  return files
    .map((f) => `// ===== ${f.path} =====\n${f.content.trimEnd()}\n`)
    .join("\n");
}

export function renamePath(path: string, nextName: string): string {
  const dir = dirFromPath(path);
  return dir ? `${dir}/${nextName}` : nextName;
}

export function movePath(path: string, folder: string): string {
  const { file } = splitPath(path);
  return folder ? `${folder}/${file}` : file;
}

export function lineCountLabel(files: ProjectFile[], id: string | null): string {
  const file = files.find((f) => f.id === id);
  if (!file) return "";
  return `${countLines(file.content)} lines`;
}
