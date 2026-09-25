import type { NamingConvention } from "@/lib/types";
import { joinPath, splitPath } from "@/lib/utils";

export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s._/-]+/)
    .filter(Boolean);
}

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function toFileName(name: string, naming: NamingConvention): string {
  const words = splitWords(name);
  if (words.length === 0) return "module";
  switch (naming) {
    case "kebab":
      return words.map((w) => w.toLowerCase()).join("-");
    case "snake":
      return words.map((w) => w.toLowerCase()).join("_");
    case "camel":
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : cap(w)))
        .join("");
    case "pascal":
      return words.map(cap).join("");
    default:
      return words.map((w) => w.toLowerCase()).join("-");
  }
}

export function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const { dir, base, ext } = splitPath(path);
  let n = 2;
  while (used.has(joinPath(dir, `${base}-${n}${ext}`))) n += 1;
  const next = joinPath(dir, `${base}-${n}${ext}`);
  used.add(next);
  return next;
}

export function concernKey(name: string): string {
  const words = splitWords(name);
  if (words.length === 0) return "misc";
  const last = words[words.length - 1]?.toLowerCase() ?? "misc";
  if (last.length <= 2 && words.length >= 2) {
    return words[words.length - 2]!.toLowerCase();
  }
  return last;
}

export function relativeImport(fromPath: string, toPath: string): string {
  const fromDir = fromPath.split("/").slice(0, -1).filter(Boolean);
  const toNoExt = toPath.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/i, "");
  const toParts = toNoExt.split("/").filter(Boolean);
  let i = 0;
  while (i < fromDir.length && i < toParts.length - 1 && fromDir[i] === toParts[i]) {
    i += 1;
  }
  const ups = fromDir.length - i;
  const down = toParts.slice(i);
  const parts = [...Array.from({ length: ups }, () => ".."), ...down];
  const rel = parts.join("/") || ".";
  return rel.startsWith(".") ? rel : `./${rel}`;
}

export function pythonRelativeImport(fromPath: string, toPath: string, names: string[]): string {
  const fromDir = fromPath.split("/").slice(0, -1).filter(Boolean);
  const toNoExt = toPath.replace(/\.py$/i, "");
  const toParts = toNoExt.split("/").filter(Boolean);
  let i = 0;
  while (i < fromDir.length && i < toParts.length - 1 && fromDir[i] === toParts[i]) {
    i += 1;
  }
  const ups = fromDir.length - i;
  const down = toParts.slice(i);
  const dots = ".".repeat(ups + 1);
  const mod = down.join(".");
  return `from ${dots}${mod} import ${names.join(", ")}`;
}
