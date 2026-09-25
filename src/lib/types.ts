export type SplitMode = "minimal" | "balanced" | "maximum";

export type NamingConvention = "kebab" | "camel" | "pascal" | "snake";

export type ThemeName = "dark" | "light" | "brand";

export type MobileTab = "source" | "structure" | "preview" | "analysis";

export type LanguageId =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "ruby"
  | "css"
  | "html"
  | "json"
  | "markdown"
  | "php"
  | "sql"
  | "shell"
  | "unknown";

export type SplitSettings = {
  mode: SplitMode;
  preserveComments: boolean;
  generateBarrel: boolean;
  generateReadme: boolean;
  generateTests: boolean;
  includeTypesFile: boolean;
  folderByKind: boolean;
  maxFileLines: number;
  naming: NamingConvention;
};

export const DEFAULT_SETTINGS: SplitSettings = {
  mode: "balanced",
  preserveComments: true,
  generateBarrel: true,
  generateReadme: true,
  generateTests: false,
  includeTypesFile: true,
  folderByKind: false,
  maxFileLines: 160,
  naming: "kebab",
};

export type SourceDocument = {
  name: string;
  content: string;
  language: LanguageId;
  extension: string;
};

export type ProjectFile = {
  id: string;
  path: string;
  content: string;
  language: LanguageId;
  originText?: string;
  originStartLine?: number;
  originEndLine?: number;
  imports: string[];
  kind: "code" | "types" | "barrel" | "readme" | "test" | "other";
};

export type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  language?: LanguageId;
  kind?: ProjectFile["kind"];
  children?: TreeNode[];
};

export type AnalysisWarning = {
  id: string;
  severity: "info" | "warn" | "error";
  message: string;
  path?: string;
};

export type AnalysisSuggestion = {
  id: string;
  title: string;
  detail: string;
};

export type LanguageSlice = {
  language: LanguageId;
  files: number;
  lines: number;
};

export type AnalysisResult = {
  files: number;
  folders: number;
  totalLines: number;
  totalBytes: number;
  avgLinesPerFile: number;
  largestFile: { path: string; lines: number } | null;
  languageBreakdown: LanguageSlice[];
  fileSizes: { path: string; lines: number }[];
  complexityScore: number;
  warnings: AnalysisWarning[];
  suggestions: AnalysisSuggestion[];
  dependencies: { from: string; to: string }[];
};

export type RefactorActionId =
  | "improve-names"
  | "extract-helpers"
  | "add-types"
  | "add-docs"
  | "generate-tests"
  | "simplify";

export type RefactorSuggestion = {
  id: string;
  action: RefactorActionId;
  fileId: string;
  filePath: string;
  title: string;
  summary: string;
  content: string;
  status: "ready" | "applied" | "discarded";
};

export type SourceUnit = {
  kind: "import" | "type" | "class" | "function" | "const" | "comment" | "other";
  name: string;
  text: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  declared: string[];
};
