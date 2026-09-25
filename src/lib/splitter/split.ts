import type {
  LanguageId,
  ProjectFile,
  SourceDocument,
  SourceUnit,
  SplitSettings,
} from "@/lib/types";
import { countLines, uid } from "@/lib/utils";
import { analyzeProject } from "./analyze";
import { fileExtensionFor, isJsLike, isKeyword } from "./language";
import { concernKey, pythonRelativeImport, relativeImport, toFileName, uniquePath } from "./names";
import { leadingImports, parseSource } from "./parse";

function commentPrefix(language: LanguageId): { start: string; end: string } {
  if (language === "python" || language === "shell") return { start: "# ", end: "" };
  if (language === "html") return { start: "<!-- ", end: " -->" };
  if (language === "css") return { start: "/* ", end: " */" };
  return { start: "// ", end: "" };
}

function fileComment(language: LanguageId, text: string): string {
  const { start, end } = commentPrefix(language);
  return `${start}${text}${end}\n`;
}

function wrapUnit(unit: SourceUnit, settings: SplitSettings, language: LanguageId): string {
  const body = unit.text.trimEnd();
  if (!settings.preserveComments) return `${body}\n`;
  if (unit.kind === "comment" || unit.kind === "import") return `${body}\n`;
  return `${fileComment(language, `${unit.kind}: ${unit.name}  (lines ${unit.startLine}–${unit.endLine})`)}${body}\n`;
}

function usedSymbols(content: string, symbols: string[]): string[] {
  const used: string[] = [];
  for (const name of symbols) {
    if (name.length < 2 || isKeyword(name)) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${name}([^A-Za-z0-9_$]|$)`);
    if (re.test(content)) used.push(name);
  }
  return used;
}

function filterOriginalImports(importBlock: string, body: string): string {
  if (!importBlock.trim()) return "";
  const lines = importBlock.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (!/^\s*(import|from|using|require|#include|package)\b/.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("#") && !line.trim().startsWith("/*") && line.trim() !== "*" && !line.includes("*/")) {
      if (line.trim() === "") {
        kept.push(line);
      }
      continue;
    }
    const names = Array.from(line.matchAll(/[A-Za-z_$][\w$]*/g)).map((m) => m[0]);
    const interesting = names.filter((n) => n.length > 1 && !isKeyword(n) && !["from", "import", "as", "type"].includes(n));
    if (interesting.length === 0 || interesting.some((n) => usedSymbols(body, [n]).length > 0)) {
      kept.push(line);
    }
  }
  return kept.join("\n").trim() ? `${kept.join("\n").trim()}\n` : "";
}

type PlannedFile = {
  path: string;
  units: SourceUnit[];
  kind: ProjectFile["kind"];
};

function planFiles(
  units: SourceUnit[],
  settings: SplitSettings,
  ext: string,
  root: string,
): PlannedFile[] {
  const codeUnits = units.filter((u) => u.kind !== "import" && u.kind !== "comment");
  const types = codeUnits.filter((u) => u.kind === "type");
  const rest = codeUnits.filter((u) => u.kind !== "type");
  const srcRoot = `${root}/src`;

  if (settings.mode === "minimal") {
    const files: PlannedFile[] = [];
    if (settings.includeTypesFile && types.length) {
      files.push({ path: `${srcRoot}/types.${ext}`, units: types, kind: "types" });
    } else {
      rest.unshift(...types);
    }
    const classes = rest.filter((u) => u.kind === "class");
    const fns = rest.filter((u) => u.kind !== "class");
    if (fns.length) files.push({ path: `${srcRoot}/lib.${ext}`, units: fns, kind: "code" });
    if (classes.length) files.push({ path: `${srcRoot}/index.${ext}`, units: classes, kind: "code" });
    else if (files.length) files[files.length - 1]!.path = `${srcRoot}/index.${ext}`;
    else files.push({ path: `${srcRoot}/index.${ext}`, units: codeUnits, kind: "code" });
    return files;
  }

  if (settings.mode === "maximum") {
    const files: PlannedFile[] = [];
    const kindFolder = (kind: SourceUnit["kind"]) => {
      if (!settings.folderByKind) return srcRoot;
      if (kind === "type") return `${srcRoot}/types`;
      if (kind === "class") return `${srcRoot}/classes`;
      if (kind === "function") return `${srcRoot}/functions`;
      if (kind === "const") return `${srcRoot}/constants`;
      return srcRoot;
    };
    for (const unit of codeUnits) {
      const folder =
        settings.includeTypesFile && unit.kind === "type" ? `${srcRoot}/types` : kindFolder(unit.kind);
      const base = toFileName(unit.name || "module", settings.naming);
      files.push({
        path: `${folder}/${base}.${ext}`,
        units: [unit],
        kind: unit.kind === "type" ? "types" : "code",
      });
    }
    return files;
  }

  const groups = new Map<string, SourceUnit[]>();
  const push = (key: string, unit: SourceUnit) => {
    const list = groups.get(key) ?? [];
    list.push(unit);
    groups.set(key, list);
  };

  if (settings.includeTypesFile && types.length) {
    const typeLines = types.reduce((n, u) => n + countLines(u.text), 0);
    if (typeLines <= settings.maxFileLines) {
      groups.set("types", types);
    } else {
      for (const t of types) push(`types-${concernKey(t.name)}`, t);
    }
  } else {
    for (const t of types) push(concernKey(t.name), t);
  }

  for (const unit of rest) {
    push(unit.kind === "class" ? `class-${concernKey(unit.name)}` : concernKey(unit.name), unit);
  }

  const files: PlannedFile[] = [];
  for (const [key, group] of groups) {
    const lines = group.reduce((n, u) => n + countLines(u.text), 0);
    if (lines > settings.maxFileLines && group.length > 1) {
      let chunk: SourceUnit[] = [];
      let chunkLines = 0;
      let part = 1;
      const flush = () => {
        if (!chunk.length) return;
        const name = part === 1 ? key : `${key}-${part}`;
        files.push({
          path: `${srcRoot}/${toFileName(name, settings.naming)}.${ext}`,
          units: chunk,
          kind: key.startsWith("types") ? "types" : "code",
        });
        part += 1;
        chunk = [];
        chunkLines = 0;
      };
      for (const unit of group) {
        const ul = countLines(unit.text);
        if (chunk.length && chunkLines + ul > settings.maxFileLines) flush();
        chunk.push(unit);
        chunkLines += ul;
      }
      flush();
    } else {
      files.push({
        path: `${srcRoot}/${toFileName(key, settings.naming)}.${ext}`,
        units: group,
        kind: key.startsWith("types") ? "types" : "code",
      });
    }
  }

  if (files.length === 0) {
    files.push({ path: `${srcRoot}/index.${ext}`, units: codeUnits, kind: "code" });
  }
  return files;
}

function collectDeclared(files: PlannedFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    for (const unit of file.units) {
      for (const name of unit.declared) {
        if (name && !map.has(name)) map.set(name, file.path);
      }
    }
  }
  return map;
}

function injectCrossImports(
  body: string,
  path: string,
  declared: Map<string, string>,
  language: LanguageId,
): { body: string; imports: string[] } {
  const needed = new Map<string, string[]>();
  const selfNames = new Set(
    [...declared.entries()].filter(([, p]) => p === path).map(([n]) => n),
  );
  for (const [name, fromPath] of declared) {
    if (fromPath === path) continue;
    if (selfNames.has(name)) continue;
    if (usedSymbols(body, [name]).length === 0) continue;
    const list = needed.get(fromPath) ?? [];
    list.push(name);
    needed.set(fromPath, list);
  }
  const importLines: string[] = [];
  const imports: string[] = [];
  for (const [fromPath, names] of needed) {
    imports.push(fromPath);
    if (language === "python") {
      importLines.push(pythonRelativeImport(path, fromPath, names));
    } else if (isJsLike(language)) {
      importLines.push(`import { ${names.join(", ")} } from "${relativeImport(path, fromPath)}";`);
    } else if (language === "go") {
      continue;
    } else {
      importLines.push(fileComment(language, `depends on ${fromPath} (${names.join(", ")})`).trimEnd());
    }
  }
  if (importLines.length === 0) return { body, imports };
  return { body: `${importLines.join("\n")}\n\n${body}`, imports };
}

function makeFile(
  path: string,
  content: string,
  language: LanguageId,
  kind: ProjectFile["kind"],
  units: SourceUnit[],
  imports: string[],
): ProjectFile {
  return {
    id: uid("file"),
    path,
    content: content.trimEnd() + "\n",
    language: kind === "readme" ? "markdown" : language,
    originText: units.map((u) => u.text).join("\n\n"),
    originStartLine: units[0]?.startLine,
    originEndLine: units[units.length - 1]?.endLine,
    imports,
    kind,
  };
}

function barrelContent(files: PlannedFile[], language: LanguageId, barrelPath: string): string {
  if (language === "python") {
    const names = files.flatMap((f) => f.units.flatMap((u) => u.declared)).filter(Boolean);
    const lines = files.map((f) => {
      const declared = f.units.flatMap((u) => u.declared).filter(Boolean);
      if (!declared.length) return pythonRelativeImport(barrelPath, f.path, ["*"]).replace("import *", "import *");
      return pythonRelativeImport(barrelPath, f.path, declared);
    });
    return `${lines.join("\n")}\n\n__all__ = [${names.map((n) => `"${n}"`).join(", ")}]\n`;
  }
  if (isJsLike(language)) {
    return (
      files
        .map((f) => {
          const declared = f.units.flatMap((u) => u.declared).filter(Boolean);
          const rel = relativeImport(barrelPath, f.path);
          if (declared.length === 0) return `export * from "${rel}";`;
          return `export { ${declared.join(", ")} } from "${rel}";`;
        })
        .join("\n") + "\n"
    );
  }
  return files.map((f) => fileComment(language, `re-export ${f.path}`)).join("");
}

function readmeContent(source: SourceDocument, settings: SplitSettings, files: ProjectFile[]): string {
  const byKind = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const tree = files
    .map((f) => `- \`${f.path}\`${f.kind !== "code" ? ` — ${f.kind}` : ""}`)
    .join("\n");
  return `# ${source.name.replace(/\.[^.]+$/, "")}

Generated by **Splitter Studio** using the **${settings.mode}** split.

| | |
| --- | --- |
| Source | \`${source.name}\` |
| Language | ${source.language} |
| Files | ${files.length} |
| Naming | ${settings.naming} |

## Layout

${tree}

## Notes

- Original comments were ${settings.preserveComments ? "preserved" : "stripped"}.
- Barrel index: ${settings.generateBarrel ? "yes" : "no"}.
- Kind folders: ${settings.folderByKind ? "yes" : "no"}.
${Object.entries(byKind)
  .map(([k, n]) => `- ${k}: ${n}`)
  .join("\n")}
`;
}

function testStub(file: PlannedFile, language: LanguageId, ext: string, root: string): ProjectFile | null {
  const names = file.units.flatMap((u) => u.declared).filter(Boolean);
  if (names.length === 0) return null;
  const target = file.path;
  const testPath = `${root}/tests/${toFileName(file.units[0]?.name ?? "module", "kebab")}.test.${ext}`;
  let content = "";
  if (isJsLike(language)) {
    const rel = relativeImport(testPath, target);
    content = `import { ${names.join(", ")} } from "${rel}";

describe("${file.units[0]?.name}", () => {
${names
  .map(
    (n) => `  it("exposes ${n}", () => {
    expect(${n}).toBeDefined();
  });`,
  )
  .join("\n\n")}
});
`;
  } else if (language === "python") {
    content = `from ${pythonRelativeImport(testPath, target, names).replace(/^from /, "").replace(" import", " import")}

def test_exports_exist():
${names.map((n) => `    assert ${n} is not None`).join("\n")}
`;
  } else {
    return null;
  }
  return {
    id: uid("file"),
    path: testPath,
    content,
    language,
    imports: [target],
    kind: "test",
  };
}

export function splitSource(source: SourceDocument, settings: SplitSettings): ProjectFile[] {
  const ext = fileExtensionFor(source.language, source.name, source.content);
  const root = source.name.replace(/\.[^.]+$/, "") || "project";
  const units = parseSource(source.content, source.language);
  const header = leadingImports(units);
  const planned = planFiles(units, settings, ext, root);
  const used = new Set<string>();
  for (const file of planned) {
    file.path = uniquePath(file.path, used);
  }

  const declared = collectDeclared(planned);
  const files: ProjectFile[] = [];

  for (const file of planned) {
    const body = file.units.map((u) => wrapUnit(u, settings, source.language)).join("\n");
    const originalImports = filterOriginalImports(header, body);
    const injected = injectCrossImports(body, file.path, declared, source.language);
    const banner = fileComment(
      source.language,
      `Split from ${source.name} · ${settings.mode} · ${file.units.map((u) => u.name).join(", ")}`,
    );
    const content = `${banner}${originalImports ? `${originalImports}\n` : ""}${injected.body}`;
    files.push(makeFile(file.path, content, source.language, file.kind, file.units, injected.imports));
  }

  if (settings.generateBarrel && files.some((f) => f.kind === "code" || f.kind === "types")) {
    const barrelExt = source.language === "python" ? "py" : ext;
    const barrelPath = uniquePath(`${root}/src/index.${barrelExt}`, used);
    const codeFiles = planned.filter((f) => f.kind === "code" || f.kind === "types");
    files.push({
      id: uid("file"),
      path: barrelPath,
      content: barrelContent(codeFiles, source.language, barrelPath),
      language: source.language,
      imports: codeFiles.map((f) => f.path),
      kind: "barrel",
    });
  }

  if (settings.generateTests) {
    for (const file of planned) {
      const test = testStub(file, source.language, ext === "tsx" ? "ts" : ext, root);
      if (test) {
        test.path = uniquePath(test.path, used);
        files.push(test);
      }
    }
  }

  if (settings.generateReadme) {
    const readmePath = uniquePath(`${root}/README.md`, used);
    const previewFiles = [...files];
    files.unshift({
      id: uid("file"),
      path: readmePath,
      content: readmeContent(source, settings, previewFiles),
      language: "markdown",
      imports: [],
      kind: "readme",
    });
  }

  return files;
}

export function rebuildProject(source: SourceDocument, settings: SplitSettings) {
  const files = splitSource(source, settings);
  const analysis = analyzeProject(files, source, settings);
  return { files, analysis };
}
