import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type {
  AnalysisResult,
  MobileTab,
  ProjectFile,
  RefactorActionId,
  RefactorSuggestion,
  SourceDocument,
  SplitSettings,
  ThemeName,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { runRefactor } from "@/lib/ai";
import { sourceFromFile, sourceFromSample, type SampleId } from "@/lib/samples";
import { rebuildProject } from "@/lib/splitter";
import { formatCode, movePath, projectAsText, renamePath } from "@/lib/splitter/project";
import { byteSize, countLines, downloadText, uid } from "@/lib/utils";

type StudioState = {
  theme: ThemeName;
  source: SourceDocument;
  settings: SplitSettings;
  files: ProjectFile[];
  analysis: AnalysisResult;
  selectedFileId: string | null;
  checkedIds: string[];
  expandedPaths: string[];
  mobileTab: MobileTab;
  showDiff: boolean;
  refactorBusy: boolean;
  refactorError: string | null;
  suggestions: RefactorSuggestion[];
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
  loadSample: (id: SampleId) => void;
  loadSource: (name: string, content: string) => void;
  setSourceContent: (content: string) => void;
  updateSettings: (patch: Partial<SplitSettings>) => void;
  resplit: () => void;
  selectFile: (id: string | null, opts?: { openPreview?: boolean }) => void;
  toggleChecked: (id: string) => void;
  setChecked: (ids: string[]) => void;
  toggleExpanded: (path: string) => void;
  setMobileTab: (tab: MobileTab) => void;
  setShowDiff: (show: boolean) => void;
  updateFileContent: (id: string, content: string) => void;
  renameFile: (id: string, nextName: string) => void;
  moveFile: (id: string, folder: string) => void;
  formatSelected: () => void;
  copySelected: () => Promise<void>;
  copyProject: () => Promise<void>;
  downloadSelectedFile: () => void;
  downloadSelectedFiles: () => Promise<void>;
  downloadZip: () => Promise<void>;
  runAi: (action: RefactorActionId) => Promise<void>;
  applySuggestion: (id: string) => void;
  discardSuggestion: (id: string) => void;
};

const initialSource = sourceFromSample("typescript");
const initialProject = rebuildProject(initialSource, DEFAULT_SETTINGS);

function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      source: initialSource,
      settings: DEFAULT_SETTINGS,
      files: initialProject.files,
      analysis: initialProject.analysis,
      selectedFileId: initialProject.files.find((f) => f.kind === "code")?.id ?? initialProject.files[0]?.id ?? null,
      checkedIds: [],
      expandedPaths: Array.from(
        new Set(initialProject.files.map((f) => f.path.split("/").slice(0, -1).join("/")).filter(Boolean)),
      ),
      mobileTab: "source",
      showDiff: false,
      refactorBusy: false,
      refactorError: null,
      suggestions: [],
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      cycleTheme: () => {
        const order: ThemeName[] = ["dark", "light", "brand"];
        const next = order[(order.indexOf(get().theme) + 1) % order.length]!;
        get().setTheme(next);
      },
      loadSample: (id) => {
        get().loadSource(sourceFromSample(id).name, sourceFromSample(id).content);
      },
      loadSource: (name, content) => {
        if (byteSize(content) > 500_000) {
          toast.error("File is larger than 500 KB.");
          return;
        }
        const source = sourceFromFile(name, content);
        const { files, analysis } = rebuildProject(source, get().settings);
        const expanded = Array.from(
          new Set(files.map((f) => f.path.split("/").slice(0, -1).join("/")).filter(Boolean)),
        );
        set({
          source,
          files,
          analysis,
          selectedFileId: files.find((f) => f.kind === "code")?.id ?? files[0]?.id ?? null,
          checkedIds: [],
          expandedPaths: expanded,
          suggestions: [],
          refactorError: null,
          showDiff: false,
        });
        toast.success(`Split ${name} into ${files.length} files.`);
      },
      setSourceContent: (content) => {
        const current = get().source;
        set({ source: { ...current, content } });
      },
      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch };
        const { files, analysis } = rebuildProject(get().source, settings);
        set({
          settings,
          files,
          analysis,
          selectedFileId: files.find((f) => f.path === get().files.find((x) => x.id === get().selectedFileId)?.path)?.id
            ?? files.find((f) => f.kind === "code")?.id
            ?? files[0]?.id
            ?? null,
          expandedPaths: Array.from(
            new Set(files.map((f) => f.path.split("/").slice(0, -1).join("/")).filter(Boolean)),
          ),
        });
      },
      resplit: () => {
        const { source, settings } = get();
        const { files, analysis } = rebuildProject(source, settings);
        set({
          files,
          analysis,
          selectedFileId: files.find((f) => f.kind === "code")?.id ?? files[0]?.id ?? null,
          suggestions: [],
        });
        toast.success(`Re-split into ${files.length} files.`);
      },
      selectFile: (id, opts) => {
        set({
          selectedFileId: id,
          showDiff: false,
          ...(opts?.openPreview ? { mobileTab: "preview" as const } : {}),
        });
      },
      toggleChecked: (id) => {
        const checkedIds = get().checkedIds.includes(id)
          ? get().checkedIds.filter((x) => x !== id)
          : [...get().checkedIds, id];
        set({ checkedIds });
      },
      setChecked: (ids) => set({ checkedIds: ids }),
      toggleExpanded: (path) => {
        const expandedPaths = get().expandedPaths.includes(path)
          ? get().expandedPaths.filter((p) => p !== path)
          : [...get().expandedPaths, path];
        set({ expandedPaths });
      },
      setMobileTab: (mobileTab) => set({ mobileTab }),
      setShowDiff: (showDiff) => set({ showDiff }),
      updateFileContent: (id, content) => {
        const files = get().files.map((f) => (f.id === id ? { ...f, content } : f));
        const { analysis } = { analysis: get().analysis };
        set({ files, analysis: { ...analysis, totalLines: files.reduce((n, f) => n + countLines(f.content), 0) } });
      },
      renameFile: (id, nextName) => {
        const name = nextName.trim();
        if (!name || name.includes("/")) {
          toast.error("Enter a file name without slashes.");
          return;
        }
        const files = get().files.map((f) => (f.id === id ? { ...f, path: renamePath(f.path, name) } : f));
        if (new Set(files.map((f) => f.path)).size !== files.length) {
          toast.error("A file with that name already exists.");
          return;
        }
        set({ files });
        toast.success("File renamed.");
      },
      moveFile: (id, folder) => {
        const files = get().files.map((f) => (f.id === id ? { ...f, path: movePath(f.path, folder) } : f));
        if (new Set(files.map((f) => f.path)).size !== files.length) {
          toast.error("A file already exists in that folder.");
          return;
        }
        const expandedPaths = folder && !get().expandedPaths.includes(folder)
          ? [...get().expandedPaths, folder]
          : get().expandedPaths;
        set({ files, expandedPaths });
        toast.success("File moved.");
      },
      formatSelected: () => {
        const { selectedFileId, files } = get();
        const file = files.find((f) => f.id === selectedFileId);
        if (!file) return;
        const content = formatCode(file.content, file.path);
        get().updateFileContent(file.id, content);
        toast.success("Formatted file.");
      },
      copySelected: async () => {
        const file = get().files.find((f) => f.id === get().selectedFileId);
        if (!file) {
          toast.error("Select a file first.");
          return;
        }
        const ok = await writeClipboard(file.content);
        toast[ok ? "success" : "error"](ok ? `Copied ${file.path}` : "Copy failed.");
      },
      copyProject: async () => {
        const text = projectAsText(get().files);
        const ok = await writeClipboard(text);
        toast[ok ? "success" : "error"](ok ? "Copied entire project." : "Copy failed.");
      },
      downloadSelectedFile: () => {
        const file = get().files.find((f) => f.id === get().selectedFileId);
        if (!file) {
          toast.error("Select a file first.");
          return;
        }
        downloadText(file.content, file.path.split("/").pop() ?? "file.txt");
        toast.success(`Downloading ${file.path.split("/").pop()}`);
      },
      downloadSelectedFiles: async () => {
        const ids = get().checkedIds;
        const files = get().files.filter((f) => ids.includes(f.id));
        if (files.length === 0) {
          toast.error("Check one or more files in Structure first.");
          return;
        }
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (const file of files) zip.file(file.path, file.content);
        const blob = await zip.generateAsync({ type: "blob" });
        const { downloadBlob } = await import("@/lib/utils");
        downloadBlob(blob, "selected-files.zip");
        toast.success(`Downloading ${files.length} files.`);
      },
      downloadZip: async () => {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (const file of get().files) zip.file(file.path, file.content);
        const blob = await zip.generateAsync({ type: "blob" });
        const { downloadBlob } = await import("@/lib/utils");
        const base = get().source.name.replace(/\.[^.]+$/, "") || "project";
        downloadBlob(blob, `${base}-split.zip`);
        toast.success("Downloading project ZIP.");
      },
      runAi: async (action) => {
        const file = get().files.find((f) => f.id === get().selectedFileId);
        if (!file) {
          toast.error("Select a file in Preview first.");
          return;
        }
        set({ refactorBusy: true, refactorError: null });
        try {
          const result = await runRefactor({
            data: {
              action,
              filePath: file.path,
              content: file.content,
              language: file.language,
            },
          });
          if (!result.ok) {
            set({ refactorBusy: false, refactorError: result.error });
            toast.error(result.error);
            return;
          }
          const suggestion: RefactorSuggestion = {
            id: uid("ref"),
            action,
            fileId: file.id,
            filePath: file.path,
            title: result.title,
            summary: `Updated ${file.path} (${countLines(result.text)} lines).`,
            content: result.text.endsWith("\n") ? result.text : `${result.text}\n`,
            status: "ready",
          };
          set({
            refactorBusy: false,
            suggestions: [suggestion, ...get().suggestions].slice(0, 8),
          });
          toast.success(`${result.title} ready to apply.`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Refactor failed.";
          set({ refactorBusy: false, refactorError: message });
          toast.error(message);
        }
      },
      applySuggestion: (id) => {
        const suggestion = get().suggestions.find((s) => s.id === id);
        if (!suggestion) return;
        get().updateFileContent(suggestion.fileId, suggestion.content);
        set({
          suggestions: get().suggestions.map((s) => (s.id === id ? { ...s, status: "applied" } : s)),
          selectedFileId: suggestion.fileId,
        });
        toast.success(`Applied ${suggestion.title}.`);
      },
      discardSuggestion: (id) => {
        set({
          suggestions: get().suggestions.map((s) => (s.id === id ? { ...s, status: "discarded" } : s)),
        });
      },
    }),
    {
      name: "splitter-studio-v1",
      partialize: (state) => ({ theme: state.theme, settings: state.settings }),
    },
  ),
);

export function selectedFile(): ProjectFile | undefined {
  const { files, selectedFileId } = useStudioStore.getState();
  return files.find((f) => f.id === selectedFileId);
}
