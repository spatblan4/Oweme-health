from dataclasses import dataclass
import os

from dotenv import find_dotenv, load_dotenv


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    supabase_url: str
    supabase_service_role_key: str
    uploads_bucket: str
    poll_seconds: int


def load_config() -> WorkerConfig:
    env_path = find_dotenv(".env.local", usecwd=True)
    if env_path:
        load_dotenv(env_path, override=False)

    return WorkerConfig(
        database_url=os.environ.get("DATABASE_URL", ""),
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        uploads_bucket=os.environ.get("SUPABASE_STORAGE_BUCKET_UPLOADS", "uploads"),
        poll_seconds=int(os.environ.get("WORKER_POLL_SECONDS", "10")),
    )
