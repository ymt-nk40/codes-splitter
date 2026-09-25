import type {
  AnalysisResult,
  AnalysisSuggestion,
  AnalysisWarning,
  LanguageId,
  ProjectFile,
  SourceDocument,
  SplitSettings,
} from "@/lib/types";
import { byteSize, countLines, dirFromPath } from "@/lib/utils";

function complexityOf(content: string): number {
  const matches = content.match(/\b(if|else if|elif|for|while|switch|case|catch|&&|\|\||\?)\b/g);
  return matches?.length ?? 0;
}

export function analyzeProject(
  files: ProjectFile[],
  source: SourceDocument,
  settings: SplitSettings,
): AnalysisResult {
  const folders = new Set(files.map((f) => dirFromPath(f.path)).filter(Boolean));
  const fileSizes = files
    .map((f) => ({ path: f.path, lines: countLines(f.content) }))
    .sort((a, b) => b.lines - a.lines);
  const totalLines = fileSizes.reduce((n, f) => n + f.lines, 0);
  const totalBytes = files.reduce((n, f) => n + byteSize(f.content), 0);
  const largestFile = fileSizes[0] ?? null;

  const langMap = new Map<LanguageId, { files: number; lines: number }>();
  for (const file of files) {
    const cur = langMap.get(file.language) ?? { files: 0, lines: 0 };
    cur.files += 1;
    cur.lines += countLines(file.content);
    langMap.set(file.language, cur);
  }

  const complexityScore = files.reduce((n, f) => n + complexityOf(f.content), 0);
  const dependencies = files.flatMap((f) => f.imports.map((to) => ({ from: f.path, to })));

  const warnings: AnalysisWarning[] = [];
  const suggestions: AnalysisSuggestion[] = [];

  for (const file of files) {
    const lines = countLines(file.content);
    if (file.kind === "code" && lines > settings.maxFileLines) {
      warnings.push({
        id: `oversize-${file.id}`,
        severity: "warn",
        message: `${file.path} has ${lines} lines (limit ${settings.maxFileLines}).`,
        path: file.path,
      });
    }
    if (lines > 320 && file.kind === "code") {
      warnings.push({
        id: `huge-${file.id}`,
        severity: "error",
        message: `${file.path} is still very large (${lines} lines). Try Maximum split.`,
        path: file.path,
      });
    }
    if (file.content.trim().length === 0) {
      warnings.push({
        id: `empty-${file.id}`,
        severity: "warn",
        message: `${file.path} is empty.`,
        path: file.path,
      });
    }
  }

  const pair = new Set(dependencies.map((d) => `${d.from}→${d.to}`));
  for (const dep of dependencies) {
    if (pair.has(`${dep.to}→${dep.from}`)) {
      warnings.push({
        id: `cycle-${dep.from}-${dep.to}`,
        severity: "warn",
        message: `Possible circular import between ${dep.from} and ${dep.to}.`,
        path: dep.from,
      });
    }
  }

  const codeFiles = files.filter((f) => f.kind === "code");
  if (codeFiles.length === 1 && countLines(source.content) > 80) {
    suggestions.push({
      id: "try-balanced",
      title: "Split produced a single module",
      detail: "The parser found few top-level units. Try Balanced or Maximum, or paste a file with more declarations.",
    });
  }
  if (settings.mode === "minimal" && (largestFile?.lines ?? 0) > 180) {
    suggestions.push({
      id: "upgrade-mode",
      title: "Move to Balanced split",
      detail: "Minimal mode left a large module. Balanced groups by concern and respects the line budget.",
    });
  }
  if (settings.mode === "maximum" && files.length > 24) {
    suggestions.push({
      id: "too-granular",
      title: "Maximum split is very granular",
      detail: "Consider Balanced mode or turning off kind folders for a smaller tree.",
    });
  }
  if (!settings.generateBarrel && files.length > 4 && (source.language === "typescript" || source.language === "javascript" || source.language === "python")) {
    suggestions.push({
      id: "add-barrel",
      title: "Add a barrel index",
      detail: "A generated index file makes the split project easier to import from a single entry.",
    });
  }
  if (!settings.generateTests && codeFiles.length >= 3) {
    suggestions.push({
      id: "add-tests",
      title: "Generate test stubs",
      detail: "Enable test stubs in advanced settings to drop describe/it scaffolds beside each module.",
    });
  }
  if (complexityScore / Math.max(1, codeFiles.length) > 18) {
    suggestions.push({
      id: "ai-simplify",
      title: "High branching complexity",
      detail: "Open a dense file in Preview and run Simplify logic from AI refactoring.",
    });
  }

  const uniqueWarnings = warnings.filter(
    (w, i, arr) => arr.findIndex((x) => x.message === w.message) === i,
  );

  return {
    files: files.length,
    folders: folders.size,
    totalLines,
    totalBytes,
    avgLinesPerFile: files.length ? Math.round(totalLines / files.length) : 0,
    largestFile,
    languageBreakdown: [...langMap.entries()].map(([language, v]) => ({ language, ...v })),
    fileSizes: fileSizes.slice(0, 16),
    complexityScore,
    warnings: uniqueWarnings,
    suggestions,
    dependencies,
  };
}
