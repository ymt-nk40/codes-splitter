import type { LanguageId } from "@/lib/types";

const EXT_MAP: Record<string, LanguageId> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
  css: "css",
  scss: "css",
  less: "css",
  html: "html",
  htm: "html",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  vue: "javascript",
  svelte: "javascript",
};

export const LANGUAGE_LABEL: Record<LanguageId, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  markdown: "Markdown",
  php: "PHP",
  sql: "SQL",
  shell: "Shell",
  unknown: "Plain text",
};

export const LANGUAGE_EXT: Record<LanguageId, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  go: "go",
  rust: "rs",
  java: "java",
  ruby: "rb",
  css: "css",
  html: "html",
  json: "json",
  markdown: "md",
  php: "php",
  sql: "sql",
  shell: "sh",
  unknown: "txt",
};

export const MONACO_LANG: Record<LanguageId, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  ruby: "ruby",
  css: "css",
  html: "html",
  json: "json",
  markdown: "markdown",
  php: "php",
  sql: "sql",
  shell: "shell",
  unknown: "plaintext",
};

const KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "switch",
  "case",
  "break",
  "return",
  "new",
  "this",
  "super",
  "class",
  "function",
  "const",
  "let",
  "var",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "yield",
  "with",
  "do",
  "continue",
  "debugger",
  "delete",
  "enum",
  "interface",
  "type",
  "package",
  "public",
  "private",
  "protected",
  "static",
  "implements",
  "extends",
  "def",
  "elif",
  "except",
  "lambda",
  "pass",
  "raise",
  "None",
  "True",
  "False",
  "self",
  "cls",
  "fn",
  "mut",
  "pub",
  "struct",
  "impl",
  "mod",
  "use",
  "func",
  "defer",
  "go",
  "chan",
  "select",
  "map",
  "range",
]);

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export function detectLanguage(name: string, content: string): LanguageId {
  const ext = extensionOf(name);
  if (ext && EXT_MAP[ext]) {
    if (EXT_MAP[ext] === "javascript" && /:\s*(string|number|boolean|unknown|void)\b/.test(content)) {
      return "typescript";
    }
    return EXT_MAP[ext];
  }
  const head = content.slice(0, 800);
  if (/^#!.*python/.test(head) || /^\s*(def|class|from|import)\s/m.test(head) && head.includes(":") && !head.includes("{")) {
    return "python";
  }
  if (/^package\s+\w+/.test(head) && /\bfunc\s+/.test(content)) return "go";
  if (/\b(fn|let mut|impl)\s/.test(head)) return "rust";
  if (/\b(interface|type)\s+\w+/.test(content) || /:\s*(string|number|boolean)\b/.test(content)) {
    return "typescript";
  }
  if (/\b(function|const|let|export|import)\b/.test(head)) return "javascript";
  if (/^\s*</.test(head) && /<\/?[a-z]/i.test(head)) return "html";
  if (/\{[\s\S]*:\s*[\s\S]*\}/.test(head) && head.trim().startsWith("{")) return "json";
  return "unknown";
}

export function isJsLike(lang: LanguageId): boolean {
  return lang === "javascript" || lang === "typescript";
}

export function isCLike(lang: LanguageId): boolean {
  return (
    isJsLike(lang) ||
    lang === "go" ||
    lang === "rust" ||
    lang === "java" ||
    lang === "css" ||
    lang === "php"
  );
}

export function usesJsx(name: string, content: string): boolean {
  const ext = extensionOf(name);
  if (ext === "tsx" || ext === "jsx") return true;
  return /<[A-Z][A-Za-z0-9]*[\s/>]/.test(content) || /className=/.test(content);
}

export function fileExtensionFor(
  language: LanguageId,
  originalName: string,
  content: string,
): string {
  const orig = extensionOf(originalName);
  if (language === "typescript") return usesJsx(originalName, content) || orig === "tsx" ? "tsx" : "ts";
  if (language === "javascript") return usesJsx(originalName, content) || orig === "jsx" ? "jsx" : "js";
  return LANGUAGE_EXT[language];
}

export function isKeyword(name: string): boolean {
  return KEYWORDS.has(name);
}

export function monacoLanguage(language: LanguageId, path: string): string {
  if (path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return MONACO_LANG[language];
}
