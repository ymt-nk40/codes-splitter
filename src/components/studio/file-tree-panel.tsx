import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filesToTree, listFolders } from "@/lib/splitter/project";
import type { ProjectFile, TreeNode } from "@/lib/types";
import { cn, downloadText } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useStudioStore } from "@/store/studio-store";
import { toast } from "sonner";

function FileActions({
  file,
  onRename,
  onMove,
}: {
  file: ProjectFile;
  onRename: () => void;
  onMove: () => void;
}) {
  const selectFile = useStudioStore((s) => s.selectFile);
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  const items = (
    <>
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-md px-3 text-sm hover:bg-background-muted md:min-h-8"
        onClick={() => {
          selectFile(file.id, { openPreview: true });
          setOpen(false);
        }}
      >
        Open in Preview
      </button>
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-md px-3 text-sm hover:bg-background-muted md:min-h-8"
        onClick={() => {
          onRename();
          setOpen(false);
        }}
      >
        Rename
      </button>
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-md px-3 text-sm hover:bg-background-muted md:min-h-8"
        onClick={() => {
          onMove();
          setOpen(false);
        }}
      >
        Move
      </button>
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-md px-3 text-sm hover:bg-background-muted md:min-h-8"
        onClick={() => {
          downloadText(file.content, file.path.split("/").pop() ?? "file.txt");
          toast.success("Downloading file.");
          setOpen(false);
        }}
      >
        Download
      </button>
      <button
        type="button"
        className="flex min-h-11 w-full items-center rounded-md px-3 text-sm hover:bg-background-muted md:min-h-8"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(file.path);
            toast.success("Copied path.");
          } catch {
            toast.error("Copy failed.");
          }
          setOpen(false);
        }}
      >
        Copy path
      </button>
    </>
  );

  if (!isDesktop) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0"
          aria-label={`Actions for ${file.path}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <MoreHorizontal className="size-4" />
        </Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="truncate">{file.path.split("/").pop()}</DrawerTitle>
              <DrawerDescription className="truncate">{file.path}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col px-2 pb-4">{items}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`Actions for ${file.path}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() => selectFile(file.id, { openPreview: true })}
        >
          Open in Preview
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onMove}>Move</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            downloadText(file.content, file.path.split("/").pop() ?? "file.txt");
            toast.success("Downloading file.");
          }}
        >
          Download
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(file.path).then(
              () => toast.success("Copied path."),
              () => toast.error("Copy failed."),
            );
          }}
        >
          Copy path
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TreeRow({
  node,
  depth,
  filesById,
  onRename,
  onMove,
}: {
  node: TreeNode;
  depth: number;
  filesById: Map<string, ProjectFile>;
  onRename: (file: ProjectFile) => void;
  onMove: (file: ProjectFile) => void;
}) {
  const selectedFileId = useStudioStore((s) => s.selectedFileId);
  const expandedPaths = useStudioStore((s) => s.expandedPaths);
  const checkedIds = useStudioStore((s) => s.checkedIds);
  const selectFile = useStudioStore((s) => s.selectFile);
  const toggleExpanded = useStudioStore((s) => s.toggleExpanded);
  const toggleChecked = useStudioStore((s) => s.toggleChecked);
  const isDesktop = useIsDesktop();

  if (node.type === "folder") {
    const open = expandedPaths.includes(node.path);
    return (
      <div>
        <button
          type="button"
          className="flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left hover:bg-background-muted md:min-h-8"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggleExpanded(node.path)}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          {open ? <FolderOpen className="size-4 shrink-0 text-brand" /> : <Folder className="size-4 shrink-0 text-brand-muted" />}
          <span className="min-w-0 truncate text-sm">{node.name}</span>
        </button>
        {open
          ? node.children?.map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                filesById={filesById}
                onRename={onRename}
                onMove={onMove}
              />
            ))
          : null}
      </div>
    );
  }

  const file = filesById.get(node.id);
  if (!file) return null;
  const active = selectedFileId === file.id;
  return (
    <div
      className={cn(
        "group flex min-h-11 min-w-0 items-center gap-1 rounded-md pr-1 md:min-h-8",
        active ? "bg-brand/15" : "hover:bg-background-muted",
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <Checkbox
        checked={checkedIds.includes(file.id)}
        onCheckedChange={() => toggleChecked(file.id)}
        aria-label={`Select ${file.path}`}
        className="shrink-0"
      />
      <button
        type="button"
        className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left md:min-h-8"
        onClick={() => selectFile(file.id, { openPreview: !isDesktop })}
      >
        <FileCode className="size-4 shrink-0 text-foreground-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs md:text-sm" title={file.path}>
          {node.name}
        </span>
      </button>
      <FileActions file={file} onRename={() => onRename(file)} onMove={() => onMove(file)} />
    </div>
  );
}

export function FileTreePanel() {
  const files = useStudioStore((s) => s.files);
  const checkedIds = useStudioStore((s) => s.checkedIds);
  const setChecked = useStudioStore((s) => s.setChecked);
  const renameFile = useStudioStore((s) => s.renameFile);
  const moveFile = useStudioStore((s) => s.moveFile);
  const tree = useMemo(() => filesToTree(files), [files]);
  const filesById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const folders = useMemo(() => listFolders(files), [files]);
  const [rename, setRename] = useState<ProjectFile | null>(null);
  const [move, setMove] = useState<ProjectFile | null>(null);
  const [nextName, setNextName] = useState("");
  const [nextFolder, setNextFolder] = useState("");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-xs text-foreground-muted tabular-nums">{files.length} files</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setChecked(checkedIds.length === files.length ? [] : files.map((f) => f.id))}
        >
          {checkedIds.length === files.length ? "Clear" : "Select all"}
        </Button>
      </div>
      <div className="panel-scroll flex-1 px-1 py-1">
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            filesById={filesById}
            onRename={(file) => {
              setRename(file);
              setNextName(file.path.split("/").pop() ?? "");
            }}
            onMove={(file) => {
              setMove(file);
              setNextFolder(file.path.split("/").slice(0, -1).join("/"));
            }}
          />
        ))}
      </div>

      <Dialog open={Boolean(rename)} onOpenChange={(open) => !open && setRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Update the file name. Paths stay inside the current folder.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-file">File name</Label>
            <Input
              id="rename-file"
              value={nextName}
              onChange={(e) => setNextName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRename(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (rename) renameFile(rename.id, nextName);
                setRename(null);
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(move)} onOpenChange={(open) => !open && setMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>Choose a destination folder.</DialogDescription>
          </DialogHeader>
          <Select value={nextFolder} onValueChange={setNextFolder}>
            <SelectTrigger aria-label="Destination folder">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMove(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (move) moveFile(move.id, nextFolder);
                setMove(null);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
