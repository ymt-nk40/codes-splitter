from pathlib import Path
from dev_tools.config import Settings, read_limited, source_analysis, bundle_analysis

def test_large_file_is_truncated(tmp_path: Path):
    path = tmp_path / "large.js"; path.write_text("x" * 20)
    text, truncated = read_limited(path, 10)
    assert truncated and len(text) == 10

def test_source_analysis_is_heuristic():
    data = source_analysis("import React from 'react'; export function Card() { return <div/> }")
    assert "react" in data["imports"] and "Card" in data["exports"] and data["heuristic"]

def test_bundle_analysis_detects_source_map():
    data = bundle_analysis("module.exports = {}; //# sourceMappingURL=app.js.map")
    assert data["source_map_references"] == ["app.js.map"]

def test_settings_path(tmp_path: Path):
    settings = Settings(tmp_path)
    assert settings.workspace == tmp_path
