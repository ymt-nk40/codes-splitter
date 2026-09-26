from pathlib import Path
import pytest
from dev_tools.config import safe_path
from dev_tools.config import Settings

def test_traversal_is_rejected(tmp_path: Path):
    settings = Settings(tmp_path)
    with pytest.raises(PermissionError): safe_path(settings, "../outside")

def test_symlink_escape_is_rejected(tmp_path: Path):
    outside = tmp_path.parent / "outside-file"
    outside.write_text("secret")
    link = tmp_path / "link"
    try: link.symlink_to(outside)
    except OSError: pytest.skip("symlinks unavailable")
    with pytest.raises(PermissionError): safe_path(Settings(tmp_path), "link")
