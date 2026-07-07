from pathlib import Path

from worker.extract.pdf import extract_pdf_text


def extract_text(path: Path, deps: dict | None = None) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_text(path, deps=deps)
    if suffix in {".txt", ".csv"}:
        return path.read_text(encoding="utf-8")
    return ""
