import os

from worker.config import load_config


def test_load_config_reads_dotenv_local(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_STORAGE_BUCKET_UPLOADS", raising=False)
    monkeypatch.delenv("WORKER_POLL_SECONDS", raising=False)

    (tmp_path / ".env.local").write_text(
        "\n".join(
            [
                "DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres",
                "SUPABASE_URL=https://example.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY=test-service-role",
                "SUPABASE_STORAGE_BUCKET_UPLOADS=worker-uploads",
                "WORKER_POLL_SECONDS=42",
            ]
        )
    )

    config = load_config()

    assert config.database_url == "postgresql://postgres:test@localhost:5432/postgres"
    assert config.supabase_url == "https://example.supabase.co"
    assert config.supabase_service_role_key == "test-service-role"
    assert config.uploads_bucket == "worker-uploads"
    assert config.poll_seconds == 42
