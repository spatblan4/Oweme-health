from pathlib import Path
from tempfile import gettempdir

from worker.config import load_config


def create_storage_client():
    from supabase import create_client

    config = load_config()
    return create_client(config.supabase_url, config.supabase_service_role_key)


def download_bytes(bucket: str, storage_path: str) -> bytes:
    client = create_storage_client()
    return client.storage.from_(bucket).download(storage_path)


def object_exists(bucket: str, storage_path: str) -> bool:
    client = create_storage_client()
    path = Path(storage_path)
    folder = "" if str(path.parent) == "." else str(path.parent)
    rows = client.storage.from_(bucket).list(folder)
    return any(item.get("name") == path.name for item in rows or [])


def download_source_file(file_record: dict, deps: dict | None = None) -> Path:
    resolved = deps or {}
    downloader = resolved.get("download_bytes", download_bytes)
    temp_dir = Path(resolved.get("temp_dir", gettempdir()))

    file_id = file_record["id"]
    original_name = file_record.get("original_name") or Path(file_record["storage_path"]).name
    target_path = temp_dir / f"{file_id}-{Path(original_name).name}"
    target_path.write_bytes(downloader(file_record["bucket"], file_record["storage_path"]))
    return target_path
