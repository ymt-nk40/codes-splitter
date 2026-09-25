import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LANGUAGE_LABEL } from "@/lib/splitter/language";
import { formatNumber } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import { ExportMenu } from "./export-actions";
import { StudioLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { useState } from "react";

export function DesktopHeader() {
  const source = useStudioStore((s) => s.source);
  const analysis = useStudioStore((s) => s.analysis);
  const settings = useStudioStore((s) => s.settings);
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
      <StudioLogo />
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight">Splitter Studio</h1>
        <p className="hidden truncate text-xs text-foreground-muted lg:block">AI Source Code Splitter</p>
      </div>
      <div className="ml-auto hidden items-center gap-3 font-mono text-xs text-foreground-muted tabular-nums md:flex">
        <span>{LANGUAGE_LABEL[source.language]}</span>
        <span>{formatNumber(analysis.files)} files</span>
        <span>{formatNumber(analysis.totalLines)} lines</span>
        <span className="capitalize">{settings.mode}</span>
      </div>
      <ExportMenu />
      <ThemeToggle />
    </header>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const source = useStudioStore((s) => s.source);
  const analysis = useStudioStore((s) => s.analysis);
  const loadSample = useStudioStore((s) => s.loadSample);
  const copyProject = useStudioStore((s) => s.copyProject);
  const downloadZip = useStudioStore((s) => s.downloadZip);
  const cycleTheme = useStudioStore((s) => s.cycleTheme);
  const theme = useStudioStore((s) => s.theme);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background safe-pt px-3">
      <StudioLogo className="size-6" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">Splitter Studio</h1>
        <p className="truncate text-xs text-foreground-muted">
          {source.name} · {formatNumber(analysis.files)} files
        </p>
      </div>
      <ThemeToggle size="icon-lg" />
      <Button type="button" variant="ghost" size="icon-lg" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Studio menu</DrawerTitle>
            <DrawerDescription>Global actions and samples</DrawerDescription>
          </DrawerHeader>
          <nav className="flex flex-col gap-1 px-3 pb-4">
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={() => loadSample("typescript")}>
                Load TypeScript sample
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={() => loadSample("python")}>
                Load Python sample
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={() => loadSample("javascript")}>
                Load JavaScript sample
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={() => void downloadZip()}>
                Download ZIP
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={() => void copyProject()}>
                Copy entire project
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="lg" className="w-full justify-start" onClick={cycleTheme}>
                Theme: {theme}
              </Button>
            </DrawerClose>
          </nav>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
