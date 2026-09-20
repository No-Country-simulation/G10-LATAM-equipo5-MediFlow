import pytest


@pytest.mark.parametrize(
    ("db_ok", "oci_ok", "http_status"),
    [(True, True, 200), (True, False, 503), (False, True, 503), (False, False, 503)],
)
async def test_health(client, monkeypatch, db_ok, oci_ok, http_status):
    async def fake_db():
        return db_ok

    async def fake_oci():
        return oci_ok

    monkeypatch.setattr("app.features.health.service._safe_check_db", fake_db)
    monkeypatch.setattr("app.features.health.service._safe_check_oci", fake_oci)

    r = await client.get("/api/v1/health")
    assert r.status_code == http_status
    assert r.json()["database_status"] is db_ok
