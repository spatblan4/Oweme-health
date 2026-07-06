from pathlib import Path


def extract_text(path: Path) -> str:
    return path.read_text() if path.suffix == ".txt" else ""

