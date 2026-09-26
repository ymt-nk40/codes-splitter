from pathlib import Path
import fnmatch
import logging
import os
import re
import shutil
import subprocess
from mcp.server.fastmcp import FastMCP
from .config import Settings, load_settings, safe_path, relative, result, read_limited, excluded, source_analysis, bundle_analysis

logging.basicConfig(level=os.getenv("DEV_TOOLS_LOG_LEVEL", "INFO"))
log = logging.getLogger("dev-tools-mcp")
settings = load_settings()
mcp = FastMCP("dev-tools-mcp")


def guarded(fn):
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            log.warning("tool failure %s: %s", fn.__name__, exc)
            return result(error=str(exc))
    return call


def files():
    return (p for p in settings.workspace.rglob("*") if not excluded(p, settings))

@mcp.tool()
def project_status() -> dict:
    code, _, _ = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=settings.workspace, capture_output=True, text=True).returncode, "", ""
    return result({"workspace_root": str(settings.workspace), "exists": settings.workspace.exists(), "is_git_repository": code == 0, "entries": len(list(settings.workspace.iterdir()))})

@mcp.tool()
def list_directory(path: str = ".", recursive: bool = False, include_hidden: bool = False) -> dict:
    root = safe_path(settings, path)
    iterator = root.rglob("*") if recursive else root.iterdir()
    items = []
    for item in iterator:
        if excluded(item, settings) or (not include_hidden and item.name.startswith(".")): continue
        items.append({"path": relative(settings, item), "type": "directory" if item.is_dir() else "file"})
    return result(items)

@mcp.tool()
def read_text_file(path: str, start_line: int = 1, end_line: int | None = None) -> dict:
    target = safe_path(settings, path)
    if not target.is_file(): raise IsADirectoryError(path)
    if start_line < 1: raise ValueError("start_line must be at least 1")
    text, truncated = read_limited(target, settings.max_read_bytes)
    lines = text.splitlines()
    selected = lines[start_line - 1:end_line]
    return result({"path": relative(settings, target), "content": "\n".join(selected), "start_line": start_line, "end_line": start_line + len(selected) - 1}, truncated=truncated)

@mcp.tool()
def write_text_file(path: str, content: str) -> dict:
    target = safe_path(settings, path, allow_missing=True)
    if len(content.encode()) > settings.max_read_bytes: raise ValueError("content exceeds configured read limit")
    target.parent.mkdir(parents=True, exist_ok=True); target.write_text(content, encoding="utf-8")
    return result({"path": relative(settings, target), "bytes": len(content.encode())})

@mcp.tool()
def create_directory(path: str) -> dict:
    target = safe_path(settings, path, allow_missing=True); target.mkdir(parents=True, exist_ok=True)
    return result({"path": relative(settings, target)})

@mcp.tool()
def delete_path(path: str, confirmation: bool = False) -> dict:
    if not confirmation: raise ValueError("confirmation=true is required for deletion")
    target = safe_path(settings, path)
    if target == settings.workspace: raise PermissionError("The workspace root cannot be deleted")
    if target.is_dir(): target.rmdir()
    else: target.unlink()
    return result({"path": relative(settings, target), "deleted": True})

@mcp.tool()
def file_info(path: str) -> dict:
    target = safe_path(settings, path); stat = target.stat()
    return result({"path": relative(settings, target), "type": "directory" if target.is_dir() else "file", "size": stat.st_size, "extension": target.suffix, "modified_time": stat.st_mtime})

@mcp.tool()
def search_text(query: str, path: str = ".", extensions: list[str] | None = None, case_sensitive: bool = False, max_results: int = 100) -> dict:
    root = safe_path(settings, path); needle = query if case_sensitive else query.lower(); matches = []
    candidates = [root] if root.is_file() else files()
    for item in candidates:
        if not item.is_file() or (root.is_dir() and not str(item).startswith(str(root))) or (extensions and item.suffix.lower() not in {x.lower() if x.startswith(".") else "." + x.lower() for x in extensions}): continue
        text, _ = read_limited(item, settings.max_read_bytes)
        for number, line in enumerate(text.splitlines(), 1):
            if needle in (line if case_sensitive else line.lower()):
                matches.append({"path": relative(settings, item), "line": number, "text": line[:500]})
                if len(matches) >= max_results: return result(matches, truncated=True)
    return result(matches)

@mcp.tool()
def find_files(name: str | None = None, pattern: str | None = None, extension: str | None = None) -> dict:
    found = []
    for item in files():
        if not item.is_file(): continue
        if name and item.name != name: continue
        if pattern and not fnmatch.fnmatch(item.name, pattern): continue
        if extension and item.suffix.lower() != (extension if extension.startswith(".") else "." + extension).lower(): continue
        found.append(relative(settings, item))
    return result(found)

@mcp.tool()
def analyze_source_file(path: str) -> dict:
    target = safe_path(settings, path); text, truncated = read_limited(target, settings.max_read_bytes)
    return result(source_analysis(text), truncated=truncated)

@mcp.tool()
def find_symbol(query: str, path: str = ".") -> dict:
    return search_text(query, path, ["js", "jsx", "ts", "tsx", "py"], False, 100)

@mcp.tool()
def find_react_components(path: str = ".") -> dict:
    data = []
    for item in files():
        if item.suffix not in {".js", ".jsx", ".ts", ".tsx"} or not str(item).startswith(str(safe_path(settings, path))): continue
        text, _ = read_limited(item, settings.max_read_bytes); names = source_analysis(text)["react_components"]
        if names: data.append({"path": relative(settings, item), "components": names})
    return result(data)

@mcp.tool()
def find_imports(path: str) -> dict: return result(source_analysis(read_limited(safe_path(settings, path), settings.max_read_bytes)[0])["imports"])
@mcp.tool()
def find_exports(path: str) -> dict: return result(source_analysis(read_limited(safe_path(settings, path), settings.max_read_bytes)[0])["exports"])

@mcp.tool()
def analyze_bundle(path: str) -> dict: return result(bundle_analysis(read_limited(safe_path(settings, path), settings.max_read_bytes)[0]))
@mcp.tool()
def extract_source_map_reference(path: str) -> dict: return result(bundle_analysis(read_limited(safe_path(settings, path), settings.max_read_bytes)[0])["source_map_references"])
@mcp.tool()
def search_bundle(query: str, path: str, max_results: int = 100) -> dict: return search_text(query, path, ["js"], True, max_results)


def git_run(args):
    p = subprocess.run(["git", *args], cwd=settings.workspace, capture_output=True, text=True, timeout=15)
    if p.returncode: raise RuntimeError(p.stderr.strip() or "Git command failed")
    return p.stdout

@mcp.tool()
def git_status() -> dict:
    return result({"raw": git_run(["status", "--short", "--branch"])})
@mcp.tool()
def git_diff(staged: bool = False, path: str | None = None) -> dict:
    args = ["diff"] + (["--cached"] if staged else []) + (["--", relative(settings, safe_path(settings, path))] if path else [])
    text = git_run(args); return result({"diff": text[:settings.max_output_bytes]}, truncated=len(text) > settings.max_output_bytes)
@mcp.tool()
def git_log(limit: int = 20, path: str | None = None) -> dict:
    args = ["log", f"-{max(1, min(limit, 100))}", "--oneline"] + (["--", relative(settings, safe_path(settings, path))] if path else [])
    return result({"log": git_run(args)})
@mcp.tool()
def git_show(commit: str) -> dict: return result({"show": git_run(["show", "--stat", "--oneline", commit])})

@mcp.tool()
def run_command(command: list[str]) -> dict:
    if not command or Path(command[0]).name not in settings.allowed_commands: raise PermissionError("Command is not allowed by DEV_TOOLS_ALLOWED_COMMANDS")
    p = subprocess.run(command, cwd=settings.workspace, capture_output=True, text=True, timeout=settings.command_timeout)
    out = (p.stdout + p.stderr); return result({"stdout": p.stdout[:settings.max_output_bytes], "stderr": p.stderr[:settings.max_output_bytes], "exit_code": p.returncode}, truncated=len(out) > settings.max_output_bytes)

def main() -> None:
    mcp.run()

if __name__ == "__main__": main()
