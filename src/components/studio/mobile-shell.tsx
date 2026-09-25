import { BarChart3, Code2, FileCode, FolderTree } from "lucide-react";
import type { MobileTab } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import { AnalysisPanel } from "./analysis-panel";
import { MobileHeader } from "./app-header";
import { MobileExportBar } from "./export-actions";
import { FileTreePanel } from "./file-tree-panel";
import { PreviewPanel } from "./preview-panel";
import { SourcePanel } from "./source-panel";

const TABS: { id: MobileTab; label: string; icon: typeof FileCode }[] = [
  { id: "source", label: "Source", icon: FileCode },
  { id: "structure", label: "Structure", icon: FolderTree },
  { id: "preview", label: "Preview", icon: Code2 },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
];

function MobileTabBar() {
  const mobileTab = useStudioStore((s) => s.mobileTab);
  const setMobileTab = useStudioStore((s) => s.setMobileTab);
  return (
    <nav
      role="tablist"
      aria-label="Studio sections"
      className="flex shrink-0 overflow-x-auto border-b border-border bg-background px-1"
    >
      {TABS.map((tab) => {
        const active = mobileTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setMobileTab(tab.id)}
            className={cn(
              "flex min-h-11 min-w-16 flex-1 items-center justify-center gap-1.5 px-3 text-xs font-medium transition-colors",
              active ? "border-b-2 border-brand text-foreground" : "text-foreground-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function MobileShell() {
  const mobileTab = useStudioStore((s) => s.mobileTab);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <MobileHeader />
      <MobileTabBar />
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <section
          id="panel-source"
          role="tabpanel"
          aria-labelledby="tab-source"
          hidden={mobileTab !== "source"}
          className="h-full min-h-0 min-w-0"
        >
          {mobileTab === "source" ? <SourcePanel compact /> : null}
        </section>
        <section
          id="panel-structure"
          role="tabpanel"
          aria-labelledby="tab-structure"
          hidden={mobileTab !== "structure"}
          className="h-full min-h-0 min-w-0"
        >
          {mobileTab === "structure" ? <FileTreePanel /> : null}
        </section>
        <section
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          hidden={mobileTab !== "preview"}
          className="h-full min-h-0 min-w-0"
        >
          {mobileTab === "preview" ? <PreviewPanel compact /> : null}
        </section>
        <section
          id="panel-analysis"
          role="tabpanel"
          aria-labelledby="tab-analysis"
          hidden={mobileTab !== "analysis"}
          className="h-full min-h-0 min-w-0"
        >
          {mobileTab === "analysis" ? <AnalysisPanel /> : null}
        </section>
      </main>
      <MobileExportBar />
    </div>
  );
}
