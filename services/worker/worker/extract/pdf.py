from __future__ import annotations

from pathlib import Path
import os
import subprocess
import sys
import tempfile


DEFAULT_PDF_TO_TXT_SCRIPT = os.environ.get(
    "OWEME_PDF_TO_TXT_SCRIPT",
    str(Path(__file__).resolve().parents[4] / "tools" / "pdf_to_txt.py"),
)


def extract_pdf_text(
    path: Path,
    deps: dict | None = None,
) -> str:
    resolved = deps or {}
    script_path = Path(resolved.get("script_path", DEFAULT_PDF_TO_TXT_SCRIPT))
    python_executable = resolved.get("python_executable", sys.executable)

    if not script_path.exists():
        raise FileNotFoundError(f"PDF OCR script not found: {script_path}")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as out:
        output_path = Path(out.name)

    try:
        proc = subprocess.run(
            [python_executable, str(script_path), str(path), str(output_path)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "PDF OCR failed")
        return output_path.read_text(encoding="utf-8")
    finally:
        output_path.unlink(missing_ok=True)
