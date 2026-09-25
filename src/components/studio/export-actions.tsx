import { Copy, Download, Files, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudioStore } from "@/store/studio-store";

export function ExportMenu() {
  const copySelected = useStudioStore((s) => s.copySelected);
  const copyProject = useStudioStore((s) => s.copyProject);
  const downloadSelectedFile = useStudioStore((s) => s.downloadSelectedFile);
  const downloadSelectedFiles = useStudioStore((s) => s.downloadSelectedFiles);
  const downloadZip = useStudioStore((s) => s.downloadZip);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="hidden md:inline-flex">
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void copySelected()}>Copy file</DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadSelectedFile}>Download file</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadSelectedFiles()}>Download selected</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadZip()}>Download ZIP</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyProject()}>Copy entire project</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileExportBar() {
  const copySelected = useStudioStore((s) => s.copySelected);
  const copyProject = useStudioStore((s) => s.copyProject);
  const downloadSelectedFile = useStudioStore((s) => s.downloadSelectedFile);
  const downloadSelectedFiles = useStudioStore((s) => s.downloadSelectedFiles);
  const downloadZip = useStudioStore((s) => s.downloadZip);

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-background px-2 py-1.5 safe-pb">
      <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => void copySelected()}>
        <Copy className="size-4" />
        Copy
      </Button>
      <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={downloadSelectedFile}>
        <Download className="size-4" />
        File
      </Button>
      <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => void downloadSelectedFiles()}>
        <Files className="size-4" />
        Selected
      </Button>
      <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => void downloadZip()}>
        <FolderArchive className="size-4" />
        ZIP
      </Button>
      <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => void copyProject()}>
        <Copy className="size-4" />
        Project
      </Button>
    </div>
  );
}
