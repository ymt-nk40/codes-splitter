import type { LanguageId, SourceUnit } from "@/lib/types";
import { isJsLike } from "./language";

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function skipLineComment(src: string, i: number): number {
  const n = src.indexOf("\n", i);
  return n === -1 ? src.length : n;
}

function skipBlockComment(src: string, i: number): number {
  const n = src.indexOf("*/", i + 2);
  return n === -1 ? src.length : n + 2;
}

function skipString(src: string, i: number, quote: string): number {
  let p = i + 1;
  while (p < src.length) {
    const ch = src[p];
    if (ch === "\\") {
      p += 2;
      continue;
    }
    if (ch === quote) return p + 1;
    p += 1;
  }
  return src.length;
}

function skipTemplate(src: string, i: number): number {
  let p = i + 1;
  while (p < src.length) {
    const ch = src[p];
    if (ch === "\\") {
      p += 2;
      continue;
    }
    if (ch === "`") return p + 1;
    if (ch === "$" && src[p + 1] === "{") {
      p = skipBraced(src, p + 1);
      continue;
    }
    p += 1;
  }
  return src.length;
}

function skipBraced(src: string, i: number): number {
  const open = src[i];
  const close = open === "(" ? ")" : open === "[" ? "]" : "}";
  let depth = 0;
  let p = i;
  while (p < src.length) {
    const ch = src[p];
    if (ch === "/" && src[p + 1] === "/") {
      p = skipLineComment(src, p);
      continue;
    }
    if (ch === "/" && src[p + 1] === "*") {
      p = skipBlockComment(src, p);
      continue;
    }
    if (ch === "'" || ch === '"') {
      p = skipString(src, p, ch);
      continue;
    }
    if (ch === "`") {
      p = skipTemplate(src, p);
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return p + 1;
    }
    p += 1;
  }
  return src.length;
}

function skipWs(src: string, i: number): number {
  let p = i;
  while (p < src.length && /\s/.test(src[p]!)) p += 1;
  return p;
}

function skipJsTrivia(src: string, i: number): number {
  let p = i;
  while (p < src.length) {
    const n = skipWs(src, p);
    if (src[n] === "/" && src[n + 1] === "/") {
      p = skipLineComment(src, n);
      continue;
    }
    if (src[n] === "/" && src[n + 1] === "*") {
      p = skipBlockComment(src, n);
      continue;
    }
    return n;
  }
  return src.length;
}

function skipValue(src: string, i: number): number {
  let p = skipJsTrivia(src, i);
  const ch = src[p];
  if (ch === "(" || ch === "{" || ch === "[") return skipBraced(src, p);
  if (ch === "'" || ch === '"') return skipString(src, p, ch);
  if (ch === "`") return skipTemplate(src, p);
  while (p < src.length) {
    const c = src[p];
    if (c === "/" && src[p + 1] === "/") {
      p = skipLineComment(src, p);
      continue;
    }
    if (c === "/" && src[p + 1] === "*") {
      p = skipBlockComment(src, p);
      continue;
    }
    if (c === "'" || c === '"') {
      p = skipString(src, p, c);
      continue;
    }
    if (c === "`") {
      p = skipTemplate(src, p);
      continue;
    }
    if (c === "(" || c === "{" || c === "[") {
      p = skipBraced(src, p);
      continue;
    }
    if (c === ";" || c === "\n") return c === ";" ? p + 1 : p;
    p += 1;
  }
  return src.length;
}

function skipStatement(src: string, i: number): number {
  let p = i;
  while (p < src.length) {
    const ch = src[p];
    if (ch === "/" && src[p + 1] === "/") {
      p = skipLineComment(src, p);
      continue;
    }
    if (ch === "/" && src[p + 1] === "*") {
      p = skipBlockComment(src, p);
      continue;
    }
    if (ch === "'" || ch === '"') {
      p = skipString(src, p, ch);
      continue;
    }
    if (ch === "`") {
      p = skipTemplate(src, p);
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") {
      p = skipBraced(src, p);
      continue;
    }
    if (ch === ";" || ch === "\n") return ch === ";" ? p + 1 : p + 1;
    p += 1;
  }
  return src.length;
}

type DeclMatch = {
  kind: SourceUnit["kind"];
  name: string;
  exported: boolean;
  declared: string[];
  consumeFrom: number;
};

function matchJsDecl(slice: string): DeclMatch | null {
  const exportMatch = /^(export\s+)/.exec(slice);
  const rest = exportMatch ? slice.slice(exportMatch[0].length) : slice;
  const exported = Boolean(exportMatch);
  const def = /^(default\s+)/.exec(rest);
  const afterDef = def ? rest.slice(def[0].length) : rest;

  let m = /^(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)?/.exec(afterDef);
  if (m) {
    return {
      kind: "function",
      name: m[2] || (def ? "default" : "anonymous"),
      exported,
      declared: m[2] ? [m[2]] : [],
      consumeFrom: 0,
    };
  }

  m = /^(abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(afterDef);
  if (m) {
    return {
      kind: "class",
      name: m[2]!,
      exported,
      declared: [m[2]!],
      consumeFrom: 0,
    };
  }

  m = /^interface\s+([A-Za-z_$][\w$]*)/.exec(afterDef);
  if (m) {
    return { kind: "type", name: m[1]!, exported, declared: [m[1]!], consumeFrom: 0 };
  }

  m = /^type\s+([A-Za-z_$][\w$]*)/.exec(afterDef);
  if (m) {
    return { kind: "type", name: m[1]!, exported, declared: [m[1]!], consumeFrom: 0 };
  }

  m = /^enum\s+([A-Za-z_$][\w$]*)/.exec(afterDef);
  if (m) {
    return { kind: "type", name: m[1]!, exported, declared: [m[1]!], consumeFrom: 0 };
  }

  m = /^(declare\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(afterDef);
  if (m) {
    const name = m[3]!;
    const looksFn = /=\s*(async\s*)?(\(|[A-Za-z_$][\w$]*\s*=>)/.test(afterDef);
    return {
      kind: looksFn ? "function" : "const",
      name,
      exported,
      declared: [name],
      consumeFrom: 0,
    };
  }

  if (/^import\b/.test(slice) || (exported && /^\{/.test(rest)) || (exported && /^from\b/.test(rest))) {
    return { kind: "import", name: "imports", exported, declared: [], consumeFrom: 0 };
  }

  if (exported && /^default\b/.test(rest)) {
    return { kind: "other", name: "default", exported: true, declared: [], consumeFrom: 0 };
  }

  return null;
}

function endOfDecl(src: string, start: number, kind: SourceUnit["kind"]): number {
  let p = start;
  if (kind === "type" || kind === "class" || kind === "function") {
    while (p < src.length) {
      const ch = src[p];
      if (ch === "/" && src[p + 1] === "/") {
        p = skipLineComment(src, p);
        continue;
      }
      if (ch === "/" && src[p + 1] === "*") {
        p = skipBlockComment(src, p);
        continue;
      }
      if (ch === "'" || ch === '"') {
        p = skipString(src, p, ch);
        continue;
      }
      if (ch === "`") {
        p = skipTemplate(src, p);
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") {
        p = skipBraced(src, p);
        if (kind !== "type") {
          p = skipWs(src, p);
          if (src[p] === ";") p += 1;
          return p;
        }
        continue;
      }
      if (ch === "=") {
        p = skipValue(src, p + 1);
        p = skipWs(src, p);
        if (src[p] === ";") p += 1;
        return p;
      }
      if (ch === ";" || ch === "\n") return ch === ";" ? p + 1 : p;
      p += 1;
    }
    return src.length;
  }
  if (kind === "const" || kind === "import" || kind === "other") {
    return skipStatement(src, start);
  }
  return skipStatement(src, start);
}

export function parseJsLike(source: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  let i = 0;
  while (i < source.length) {
    const triviaStart = i;
    i = skipJsTrivia(source, i);
    if (i >= source.length) break;

    if (i > triviaStart) {
      const trivia = source.slice(triviaStart, i);
      if (trivia.includes("/*") || trivia.includes("//")) {
        const text = trivia.trim();
        if (text.length > 0 && units.length === 0) {
          units.push({
            kind: "comment",
            name: "header",
            text,
            startLine: lineAt(source, triviaStart),
            endLine: lineAt(source, i),
            exported: false,
            declared: [],
          });
        }
      }
    }

    const slice = source.slice(i, i + 240);
    const decl = matchJsDecl(slice);
    if (!decl) {
      const end = skipStatement(source, i);
      const text = source.slice(i, end).trim();
      if (text) {
        units.push({
          kind: "other",
          name: `block${units.length + 1}`,
          text: source.slice(i, end),
          startLine: lineAt(source, i),
          endLine: lineAt(source, Math.max(i, end - 1)),
          exported: false,
          declared: [],
        });
      }
      i = Math.max(end, i + 1);
      continue;
    }

    const end = endOfDecl(source, i, decl.kind);
    units.push({
      kind: decl.kind,
      name: decl.name,
      text: source.slice(i, end),
      startLine: lineAt(source, i),
      endLine: lineAt(source, Math.max(i, end - 1)),
      exported: decl.exported,
      declared: decl.declared,
    });
    i = Math.max(end, i + 1);
  }
  return units;
}

function pythonIndent(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n += 1;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

export function parsePython(source: string): SourceUnit[] {
  const lines = source.split("\n");
  const units: SourceUnit[] = [];
  let i = 0;

  while (i < lines.length && (lines[i]!.trim() === "" || lines[i]!.startsWith("#") || lines[i]!.startsWith('"""') || lines[i]!.startsWith("'''") || /^(import|from)\s/.test(lines[i]!))) {
    i += 1;
  }

  if (i > 0) {
    const header = lines.slice(0, i).join("\n");
    units.push({
      kind: "import",
      name: "header",
      text: header,
      startLine: 1,
      endLine: i,
      exported: false,
      declared: [],
    });
  }

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const indent = pythonIndent(line);
    if (indent !== 0) {
      i += 1;
      continue;
    }
    const def = /^(async\s+)?def\s+([A-Za-z_][\w]*)/.exec(line);
    const cls = /^class\s+([A-Za-z_][\w]*)/.exec(line);
    const start = i;
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!;
      if (next.trim() === "") {
        i += 1;
        continue;
      }
      if (pythonIndent(next) > 0) {
        i += 1;
        continue;
      }
      break;
    }
    let end = i;
    while (end > start + 1 && lines[end - 1]!.trim() === "") end -= 1;
    const name = def?.[2] ?? cls?.[1] ?? `block${units.length + 1}`;
    units.push({
      kind: cls ? "class" : def ? "function" : "other",
      name,
      text: lines.slice(start, end).join("\n"),
      startLine: start + 1,
      endLine: end,
      exported: !name.startsWith("_"),
      declared: [name],
    });
  }
  return units;
}

export function parseGo(source: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  let i = 0;
  while (i < source.length) {
    i = skipJsTrivia(source, i);
    if (i >= source.length) break;
    const slice = source.slice(i, i + 200);
    let kind: SourceUnit["kind"] = "other";
    let name = `block${units.length + 1}`;
    let m = /^func\s+(\([^)]+\)\s*)?([A-Za-z_][\w]*)/.exec(slice);
    if (m) {
      kind = "function";
      name = m[2]!;
    } else if ((m = /^type\s+([A-Za-z_][\w]*)/.exec(slice))) {
      kind = "type";
      name = m[1]!;
    } else if (/^(import|package)\b/.test(slice)) {
      kind = "import";
      name = "header";
    } else if ((m = /^(const|var)\s+([A-Za-z_][\w]*)/.exec(slice))) {
      kind = "const";
      name = m[2]!;
    }
    const end = endOfDecl(source, i, kind === "import" ? "other" : kind);
    units.push({
      kind,
      name,
      text: source.slice(i, end),
      startLine: lineAt(source, i),
      endLine: lineAt(source, Math.max(i, end - 1)),
      exported: /^[A-Z]/.test(name),
      declared: name === "header" ? [] : [name],
    });
    i = Math.max(end, i + 1);
  }
  return units;
}

export function parseGeneric(source: string, maxChunk = 80): SourceUnit[] {
  const parts = source.split(/\n{2,}/);
  const units: SourceUnit[] = [];
  let line = 1;
  let buf: string[] = [];
  let bufStart = 1;
  const flush = (name?: string) => {
    if (buf.length === 0) return;
    const text = buf.join("\n\n");
    const endLine = line - 1;
    units.push({
      kind: "other",
      name: name ?? `part${units.length + 1}`,
      text,
      startLine: bufStart,
      endLine: Math.max(bufStart, endLine),
      exported: true,
      declared: [],
    });
    buf = [];
  };
  for (const part of parts) {
    const partLines = part.split("\n").length;
    if (buf.length === 0) bufStart = line;
    buf.push(part);
    line += partLines + 1;
    const bufLines = buf.join("\n\n").split("\n").length;
    if (bufLines >= maxChunk) flush();
  }
  flush();
  if (units.length === 0 && source.trim()) {
    units.push({
      kind: "other",
      name: "source",
      text: source,
      startLine: 1,
      endLine: lineAt(source, source.length),
      exported: true,
      declared: [],
    });
  }
  return units;
}

export function parseSource(source: string, language: LanguageId): SourceUnit[] {
  if (isJsLike(language)) return parseJsLike(source);
  if (language === "python") return parsePython(source);
  if (language === "go") return parseGo(source);
  if (language === "json") {
    return [
      {
        kind: "other",
        name: "data",
        text: source,
        startLine: 1,
        endLine: lineAt(source, source.length),
        exported: true,
        declared: [],
      },
    ];
  }
  return parseGeneric(source);
}

export function leadingImports(units: SourceUnit[]): string {
  const header = units
    .filter((u) => u.kind === "import" || (u.kind === "comment" && u.name === "header"))
    .map((u) => u.text.trimEnd())
    .join("\n");
  return header.trim() ? `${header.trim()}\n` : "";
}
