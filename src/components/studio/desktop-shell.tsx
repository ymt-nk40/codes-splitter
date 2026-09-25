import { Group, Panel, Separator } from "react-resizable-panels";
import { AnalysisPanel } from "./analysis-panel";
import { DesktopHeader } from "./app-header";
import { FileTreePanel } from "./file-tree-panel";
import { PreviewPanel } from "./preview-panel";
import { SourcePanel } from "./source-panel";

function PanelLabel({ children }: { children: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
      <span className="text-xs font-medium tracking-widest text-foreground-muted uppercase">
        {children}
      </span>
    </div>
  );
}

export function DesktopShell() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      <DesktopHeader />
      <div className="min-h-0 min-w-0 flex-1">
        <Group orientation="vertical" className="h-full">
          <Panel defaultSize="72%" minSize="42%">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize="24%" minSize="16%" className="min-w-0">
                <div className="flex h-full min-h-0 min-w-0 flex-col border-r border-border">
                  <PanelLabel>Source</PanelLabel>
                  <div className="min-h-0 min-w-0 flex-1">
                    <SourcePanel />
                  </div>
                </div>
              </Panel>
              <Separator className="w-1" />
              <Panel defaultSize="26%" minSize="16%" className="min-w-0">
                <div className="flex h-full min-h-0 min-w-0 flex-col border-r border-border">
                  <PanelLabel>Structure</PanelLabel>
                  <div className="min-h-0 min-w-0 flex-1">
                    <FileTreePanel />
                  </div>
                </div>
              </Panel>
              <Separator className="w-1" />
              <Panel defaultSize="50%" minSize="24%" className="min-w-0">
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <PanelLabel>Preview</PanelLabel>
                  <div className="min-h-0 min-w-0 flex-1">
                    <PreviewPanel />
                  </div>
                </div>
              </Panel>
            </Group>
          </Panel>
          <Separator className="h-1" />
          <Panel defaultSize="28%" minSize="16%" className="min-w-0">
            <div className="flex h-full min-h-0 min-w-0 flex-col border-t border-border">
              <PanelLabel>Analysis</PanelLabel>
              <div className="min-h-0 min-w-0 flex-1">
                <AnalysisPanel />
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
