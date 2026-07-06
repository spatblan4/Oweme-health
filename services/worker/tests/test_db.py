from worker.db import _connection_kwargs


def test_connection_kwargs_adds_hostaddr_for_supabase_direct_host(monkeypatch):
    monkeypatch.setattr(
        "worker.db._resolve_supabase_ipv6",
        lambda hostname: "2600:1f14:b9e:7b02:c196:90f1:4f87:a746",
    )

    kwargs = _connection_kwargs(
        "postgresql://postgres:test@db.exampleprojectref.supabase.co:5432/postgres?sslmode=require"
    )

    assert kwargs == {"hostaddr": "2600:1f14:b9e:7b02:c196:90f1:4f87:a746"}


def test_connection_kwargs_ignores_non_supabase_hosts(monkeypatch):
    monkeypatch.setattr("worker.db._resolve_supabase_ipv6", lambda hostname: "ignored")

    assert _connection_kwargs("postgresql://postgres:test@localhost:5432/postgres") == {}
