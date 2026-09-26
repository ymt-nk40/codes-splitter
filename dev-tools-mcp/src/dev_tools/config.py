from dataclasses import dataclass
from pathlib import Path
import os
import re

@dataclass(frozen=True)
class Settings:
    workspace: Path
    max_read_bytes: int = 2_000_000
    max_output_bytes: int = 200_000
    command_timeout: float = 30.0
    allowed_commands: frozenset[str] = frozenset({"python", "pytest", "npm", "npx", "node", "git"})


def load_settings() -> Settings:
    raw = os.getenv("DEV_TOOLS_WORKSPACE")
    if not raw:
        raise ValueError("DEV_TOOLS_WORKSPACE is required")
    root = Path(raw).expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"Workspace is not a directory: {root}")
    def positive(name: str, default: str, cast):
        value = cast(os.getenv(name, default))
        if value <= 0:
            raise ValueError(f"{name} must be positive")
        return value
    commands = frozenset(x.strip() for x in os.getenv("DEV_TOOLS_ALLOWED_COMMANDS", "python,pytest,npm,npx,node,git").split(",") if x.strip())
    return Settings(root, int(positive("DEV_TOOLS_MAX_READ_BYTES", "2000000", int)), int(positive("DEV_TOOLS_MAX_OUTPUT_BYTES", "200000", int)), float(positive("DEV_TOOLS_COMMAND_TIMEOUT", "30", float)), commands)


def safe_path(settings: Settings, value: str, *, allow_missing: bool = False) -> Path:
    target = (settings.workspace / value).resolve(strict=False)
    try:
        target.relative_to(settings.workspace)
    except ValueError as exc:
        raise PermissionError(f"Path escapes configured workspace: {value}") from exc
    if not allow_missing and not target.exists():
        raise FileNotFoundError(f"Path does not exist inside workspace: {value}")
    return target


def relative(settings: Settings, path: Path) -> str:
    return str(path.relative_to(settings.workspace)).replace("\\", "/") or "."


def result(data=None, *, error: str | None = None, warnings=None, truncated=False) -> dict:
    return {"success": error is None, "data": data, "error": error, "warnings": warnings or [], "truncated": truncated}


def read_limited(path: Path, limit: int) -> tuple[str, bool]:
    raw = path.read_bytes()[: limit + 1]
    return raw[:limit].decode("utf-8", errors="replace"), len(raw) > limit


def excluded(path: Path, settings: Settings) -> bool:
    ignored = {".git", "node_modules", ".next", "dist", "build", "coverage", "__pycache__", ".venv"}
    return any(part in ignored for part in path.relative_to(settings.workspace).parts)


def source_analysis(text: str) -> dict:
    imports = list(dict.fromkeys(re.findall(r"(?:import\s+(?:.+?\s+from\s+)?|require\()\s*[\"']([^\"']+)", text)))
    exports = list(dict.fromkeys(re.findall(r"export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)", text)))
    functions = list(dict.fromkeys(re.findall(r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", text)))
    classes = list(dict.fromkeys(re.findall(r"class\s+([A-Za-z_$][\w$]*)", text)))
    components = list(dict.fromkeys(re.findall(r"(?:function|const|let)\s+([A-Z][A-Za-z0-9_$]*)", text)))
    return {"imports": imports, "exports": exports, "functions": functions, "classes": classes, "react_components": components, "hooks": sorted(set(re.findall(r"\b(use[A-Z][A-Za-z0-9_]*)\b", text))), "has_jsx": bool(re.search(r"</?[A-Z][\w.]*|=>\s*\(", text)), "line_count": text.count("\n") + 1, "approximate_complexity": 1 + sum(text.count(x) for x in (" if ", " for ", " while ", "&&", "||")), "heuristic": True}


def bundle_analysis(text: str) -> dict:
    refs = re.findall(r"[#@]\s*sourceMappingURL\s*=\s*([^\s*]+)", text)
    return {"size_bytes": len(text.encode()), "line_count": text.count("\n") + 1, "module_patterns": {"webpack": "webpackJsonp" in text or "__webpack_require__" in text, "vite": "import.meta" in text, "commonjs": "module.exports" in text or "require(" in text}, "source_map_references": refs, "runtime_hints": [x for x, ok in (("React", "react" in text.lower()), ("Next.js", "__next" in text.lower()), ("TypeScript", "__awaiter" in text)) if ok], "heuristic": True}
