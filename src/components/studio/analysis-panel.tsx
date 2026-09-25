import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, WandSparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REFACTOR_ACTIONS } from "@/lib/ai";
import { LANGUAGE_LABEL } from "@/lib/splitter/language";
import type { RefactorActionId } from "@/lib/types";
import { cn, formatBytes, formatNumber } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";

const ACTION_IDS = Object.keys(REFACTOR_ACTIONS) as RefactorActionId[];

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-background-muted p-3 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium tracking-wide text-foreground-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
    </div>
  );
}

export function AnalysisPanel() {
  const analysis = useStudioStore((s) => s.analysis);
  const settings = useStudioStore((s) => s.settings);
  const suggestions = useStudioStore((s) => s.suggestions);
  const refactorBusy = useStudioStore((s) => s.refactorBusy);
  const refactorError = useStudioStore((s) => s.refactorError);
  const runAi = useStudioStore((s) => s.runAi);
  const applySuggestion = useStudioStore((s) => s.applySuggestion);
  const discardSuggestion = useStudioStore((s) => s.discardSuggestion);
  const selectFile = useStudioStore((s) => s.selectFile);
  const files = useStudioStore((s) => s.files);

  const chartData = analysis.fileSizes.slice(0, 8).map((f) => ({
    name: f.path.split("/").pop() ?? f.path,
    lines: f.lines,
  }));

  return (
    <div className="panel-scroll h-full min-h-0 min-w-0 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Files" value={formatNumber(analysis.files)} hint={`${analysis.folders} folders`} />
        <MetricCard label="Lines" value={formatNumber(analysis.totalLines)} hint={`${formatBytes(analysis.totalBytes)}`} />
        <MetricCard label="Avg / file" value={formatNumber(analysis.avgLinesPerFile)} hint={`Mode ${settings.mode}`} />
        <MetricCard
          label="Complexity"
          value={formatNumber(analysis.complexityScore)}
          hint={analysis.largestFile ? `Largest ${analysis.largestFile.path.split("/").pop()}` : undefined}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border-muted bg-background-muted p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-foreground-muted uppercase">Lines by file</p>
          <div className="h-48 min-w-0 overflow-x-auto">
            <div className="h-full min-w-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} width={32} />
                  <ChartTooltip
                    contentStyle={{
                      background: "var(--color-background-muted)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="lines" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-border-muted bg-background-muted p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-foreground-muted uppercase">Languages</p>
          <ul className="flex flex-col gap-2">
            {analysis.languageBreakdown.map((slice) => (
              <li key={slice.language} className="flex items-center justify-between gap-3 text-sm">
                <span>{LANGUAGE_LABEL[slice.language]}</span>
                <span className="font-mono text-xs text-foreground-muted tabular-nums">
                  {slice.files} files · {slice.lines} lines
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium tracking-wide text-foreground-muted uppercase">Dependencies</p>
          <div className="mt-2 max-h-28 overflow-x-auto overflow-y-auto">
            <div className="flex min-w-max flex-col gap-1 font-mono text-xs text-foreground-muted">
              {analysis.dependencies.length === 0 ? (
                <span>No cross-file imports detected.</span>
              ) : (
                analysis.dependencies.slice(0, 24).map((dep, i) => (
                  <span key={`${dep.from}-${dep.to}-${i}`}>
                    {dep.from.split("/").pop()} → {dep.to.split("/").pop()}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border-muted p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-foreground-muted uppercase">Warnings</p>
          <ul className="flex flex-col gap-2">
            {analysis.warnings.length === 0 ? (
              <li className="flex items-center gap-2 text-sm text-foreground-muted">
                <CheckCircle2 className="size-4 text-success" />
                No structural warnings.
              </li>
            ) : (
              analysis.warnings.map((w) => (
                <li key={w.id} className="flex gap-2 text-sm">
                  <AlertTriangle
                    className={cn("mt-0.5 size-4 shrink-0", w.severity === "error" ? "text-destructive" : "text-warning")}
                  />
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      const file = files.find((f) => f.path === w.path);
                      if (file) selectFile(file.id, { openPreview: true });
                    }}
                  >
                    {w.message}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-border-muted p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-foreground-muted uppercase">Suggestions</p>
          <ul className="flex flex-col gap-2">
            {analysis.suggestions.length === 0 ? (
              <li className="flex items-center gap-2 text-sm text-foreground-muted">
                <Info className="size-4 text-info" />
                Split looks healthy.
              </li>
            ) : (
              analysis.suggestions.map((s) => (
                <li key={s.id} className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-foreground-muted">{s.detail}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border p-3">
        <div className="mb-3 flex items-center gap-2">
          <WandSparkles className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">AI refactoring</h2>
          {refactorBusy ? <LoaderCircle className="size-4 animate-spin text-brand" aria-label="Running" /> : null}
        </div>
        <p className="mb-3 text-xs text-foreground-muted">
          Runs on the file open in Preview. Review the result, then apply or discard.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACTION_IDS.map((id) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-start md:h-9"
              disabled={refactorBusy}
              onClick={() => void runAi(id)}
            >
              {REFACTOR_ACTIONS[id].title}
            </Button>
          ))}
        </div>
        {refactorError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {refactorError}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((item) => (
            <Accordion key={item.id} type="single" collapsible>
              <AccordionItem value={item.id}>
                <AccordionTrigger>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{item.title}</span>
                    <Badge variant={item.status === "applied" ? "success" : item.status === "discarded" ? "outline" : "brand"}>
                      {item.status}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-xs text-foreground-muted">{item.summary}</p>
                  <pre className="mb-3 max-h-40 overflow-auto rounded-md bg-background-muted p-2 font-mono text-xs">
                    {item.content.slice(0, 1200)}
                    {item.content.length > 1200 ? "\n…" : ""}
                  </pre>
                  {item.status === "ready" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" className="w-full sm:w-auto" onClick={() => applySuggestion(item.id)}>
                        Apply to file
                      </Button>
                      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => discardSuggestion(item.id)}>
                        Discard
                      </Button>
                    </div>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      </div>
    </div>
  );
}
