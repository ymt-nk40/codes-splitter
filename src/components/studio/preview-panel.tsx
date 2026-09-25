import { useEffect, useState } from "react";
import { Copy, Download, Ellipsis, Search, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { monacoLanguage } from "@/lib/splitter/language";
import { unifiedDiff } from "@/lib/splitter/project";
import { cn, countLines } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import type { ThemeName } from "@/lib/types";

type EditorComp = typeof import("@monaco-editor/react").default;

function editorTheme(theme: ThemeName): string {
  return theme === "light" ? "vs" : "vs-dark";
}

function MonacoPane({
  value,
  path,
  language,
  theme,
  onChange,
  onMountRef,
}: {
  value: string;
  path: string;
  language: string;
  theme: ThemeName;
  onChange: (value: string) => void;
  onMountRef: (editor: { trigger: (source: string, handlerId: string, payload?: unknown) => void } | null) => void;
}) {
  const [Editor, setEditor] = useState<EditorComp | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void import("@monaco-editor/react")
      .then((mod) => {
        mod.loader.config({
          paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
        });
        if (alive) setEditor(() => mod.default);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    const t = window.setTimeout(() => {
      if (alive && !Editor) setFailed(true);
    }, 8000);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [Editor]);

  if (failed && !Editor) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`Code editor for ${path}`}
        className="absolute inset-0 h-full w-full min-w-0 resize-none bg-background-muted p-3 font-mono text-sm text-foreground outline-none"
      />
    );
  }

  if (!Editor) {
    return <div className="absolute inset-0 h-full w-full bg-background-muted" aria-hidden />;
  }

  return (
    <div className="absolute inset-0 min-h-0 min-w-0">
      <Editor
        height="100%"
        width="100%"
        path={path}
        theme={editorTheme(theme)}
        language={language}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        loading={<div className="h-full w-full bg-background-muted" />}
        onMount={(ed) => onMountRef(ed)}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace",
          wordWrap: "off",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          tabSize: 2,
          lineNumbersMinChars: 3,
          overviewRulerLanes: 0,
          folding: true,
          glyphMargin: false,
          renderLineHighlight: "line",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
          ariaLabel: `Code editor for ${path}`,
        }}
      />
    </div>
  );
}

function DiffView({ original, current }: { original: string; current: string }) {
  const lines = unifiedDiff(original, current);
  return (
    <div className="panel-scroll h-full min-w-0 bg-background-muted">
      <pre className="min-w-max p-3 font-mono text-xs leading-5">
        {lines.map((line, i) => (
          <div
            key={`${i}-${line.type}`}
            className={cn(
              "px-2 whitespace-pre",
              line.type === "add" && "bg-success/15 text-success",
              line.type === "del" && "bg-destructive/15 text-destructive",
              line.type === "same" && "text-foreground-muted",
            )}
          >
            <span className="inline-block w-4">{line.type === "add" ? "+" : line.type === "del" ? "-" : " "}</span>
            {line.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function PreviewPanel({ compact = false }: { compact?: boolean }) {
  const files = useStudioStore((s) => s.files);
  const selectedFileId = useStudioStore((s) => s.selectedFileId);
  const theme = useStudioStore((s) => s.theme);
  const showDiff = useStudioStore((s) => s.showDiff);
  const setShowDiff = useStudioStore((s) => s.setShowDiff);
  const updateFileContent = useStudioStore((s) => s.updateFileContent);
  const copySelected = useStudioStore((s) => s.copySelected);
  const downloadSelectedFile = useStudioStore((s) => s.downloadSelectedFile);
  const formatSelected = useStudioStore((s) => s.formatSelected);
  const file = files.find((f) => f.id === selectedFileId) ?? files[0];
  const [editor, setEditor] = useState<{ trigger: (source: string, handlerId: string, payload?: unknown) => void } | null>(null);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-foreground-muted">
        Select a file from Structure.
      </div>
    );
  }

  const actions = (
    <>
      <Button type="button" variant="ghost" size={compact ? "icon-lg" : "icon"} aria-label="Copy file" onClick={() => void copySelected()}>
        <Copy className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size={compact ? "icon-lg" : "icon"} aria-label="Download file" onClick={downloadSelectedFile}>
        <Download className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size={compact ? "icon-lg" : "icon"} aria-label="Format file" onClick={formatSelected}>
        <Type className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon-lg" : "icon"}
        aria-label="Find in file"
        onClick={() => editor?.trigger("keyboard", "actions.find", undefined)}
      >
        <Search className="size-4" />
      </Button>
      <Button
        type="button"
        variant={showDiff ? "secondary" : "ghost"}
        size={compact ? "icon-lg" : "icon"}
        aria-label="Toggle diff"
        aria-pressed={showDiff}
        onClick={() => setShowDiff(!showDiff)}
        disabled={!file.originText}
      >
        <span className="font-mono text-xs">±</span>
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2">
        <p className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
          {file.path}
        </p>
        <Badge variant="outline">{countLines(file.content)} lines</Badge>
        {compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-lg" aria-label="Editor actions">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void copySelected()}>Copy</DropdownMenuItem>
              <DropdownMenuItem onSelect={downloadSelectedFile}>Download</DropdownMenuItem>
              <DropdownMenuItem onSelect={formatSelected}>Format</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => editor?.trigger("keyboard", "actions.find", undefined)}>Search</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowDiff(!showDiff)} disabled={!file.originText}>
                {showDiff ? "Hide diff" : "Show diff"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center">{actions}</div>
        )}
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {showDiff && file.originText ? (
          <DiffView original={file.originText} current={file.content} />
        ) : (
          <MonacoPane
            key={file.id}
            value={file.content}
            path={file.path}
            language={monacoLanguage(file.language, file.path)}
            theme={theme}
            onChange={(value) => updateFileContent(file.id, value)}
            onMountRef={setEditor}
          />
        )}
      </div>
      {compact ? (
        <div className="flex shrink-0 items-center justify-around border-t border-border bg-background-muted px-1 py-1 safe-pb">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
