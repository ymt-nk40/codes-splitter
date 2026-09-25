import { useCallback, useRef, useState } from "react";
import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_LABEL } from "@/lib/splitter/language";
import { SAMPLES, type SampleId } from "@/lib/samples";
import { byteSize, countLines, cn, formatBytes } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import { SplitControls } from "./split-controls";

export function SourcePanel({ compact = false }: { compact?: boolean }) {
  const source = useStudioStore((s) => s.source);
  const loadSource = useStudioStore((s) => s.loadSource);
  const loadSample = useStudioStore((s) => s.loadSample);
  const setSourceContent = useStudioStore((s) => s.setSourceContent);
  const resplit = useStudioStore((s) => s.resplit);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const content = await file.text();
      loadSource(file.name, content);
    },
    [loadSource],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="panel-scroll flex flex-1 flex-col gap-3 p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-center transition-colors",
            dragging ? "border-brand bg-brand/10" : "border-border bg-background-muted",
          )}
        >
          <FileUp className="size-5 text-brand" aria-hidden />
          <p className="text-sm font-medium">Drop a source file</p>
          <p className="text-xs text-foreground-muted">or paste below. JS, TS, Python, Go, and more.</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.go,.rs,.java,.rb,.css,.html,.json,.md,.vue,.svelte,.php,.sql,.sh"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" size="lg" className="w-full max-w-xs md:h-9 md:w-auto" onClick={() => inputRef.current?.click()}>
            <FolderOpen className="size-4" />
            Choose file
          </Button>
        </div>

        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-muted bg-background-muted px-3 py-2">
          <p className="truncate font-mono text-sm" title={source.name}>
            {source.name}
          </p>
          <p className="text-xs text-foreground-muted tabular-nums">
            {LANGUAGE_LABEL[source.language]} · {formatBytes(byteSize(source.content))} · {countLines(source.content)} lines
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {(Object.keys(SAMPLES) as SampleId[]).map((id) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-start md:h-9 md:flex-1 md:px-2 md:text-xs"
              onClick={() => loadSample(id)}
            >
              {SAMPLES[id].label}
            </Button>
          ))}
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <label htmlFor="source-paste" className="text-xs font-medium text-foreground-muted">
            Original source
          </label>
          <Textarea
            id="source-paste"
            value={source.content}
            onChange={(e) => setSourceContent(e.target.value)}
            spellCheck={false}
            className="min-h-48 flex-1 md:min-h-56"
            aria-label="Paste or edit original source"
          />
          <Button type="button" variant="secondary" size="lg" className="w-full md:h-9" onClick={resplit}>
            Apply pasted source
          </Button>
        </div>

        <SplitControls compact={compact} />
      </div>
    </div>
  );
}
