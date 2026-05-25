"""Tests für Authentifizierung und Autorisierung."""
import pytest
from httpx import AsyncClient


async def create_admin(client: AsyncClient) -> dict:
    """Hilfsfunktion: Setup-Wizard ausführen und Admin anlegen."""
    resp = await client.post("/api/setup/create-admin", json={
        "email": "admin@test.de",
        "display_name": "Test Admin",
        "password": "Test1234!@#$"
    })
    return resp.json()


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    """Hilfsfunktion: Token holen."""
    resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    return resp.json().get("access_token", "")


class TestSetup:
    async def test_setup_status_accessible(self, client: AsyncClient):
        """Setup-Status-Endpunkt ist erreichbar."""
        resp = await client.get("/api/setup/status")
        assert resp.status_code == 200
        assert "setup_required" in resp.json()

    async def test_create_admin_or_already_exists(self, client: AsyncClient):
        """Admin-Account anlegen oder bereits vorhanden."""
        resp = await client.post("/api/setup/create-admin", json={
            "email": "admin@test.de",
            "display_name": "Test Admin",
            "password": "Test1234!@#$"
        })
        # 200/201 = angelegt, 400 = bereits vorhanden, 422 = Setup gesperrt
        assert resp.status_code in (200, 201, 400, 422)


class TestLogin:
    async def test_login_wrong_password(self, client: AsyncClient):
        """Login mit falschem Passwort schlägt fehl."""
        resp = await client.post("/api/auth/login", json={
            "email": "admin@test.de",
            "password": "wrongpassword"
        })
        assert resp.status_code in (401, 429)  # 429 = Rate Limiter

    async def test_login_wrong_email(self, client: AsyncClient):
        """Login mit unbekannter E-Mail schlägt fehl."""
        resp = await client.post("/api/auth/login", json={
            "email": "nobody@test.de",
            "password": "Test1234!@#$"
        })
        assert resp.status_code in (401, 429)  # 429 = Rate Limiter

    async def test_login_missing_fields(self, client: AsyncClient):
        """Login ohne Felder schlägt fehl."""
        resp = await client.post("/api/auth/login", json={})
        assert resp.status_code == 422


class TestProtectedRoutes:
    async def test_no_token_returns_401(self, client: AsyncClient):
        """Ohne Token → 401."""
        resp = await client.get("/api/tickets/")
        assert resp.status_code == 401

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        """Ungültiger Token → 401."""
        resp = await client.get("/api/tickets/",
            headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401

    async def test_admin_endpoint_requires_admin(self, client: AsyncClient):
        """Admin-Endpunkt ohne Token → 401."""
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 401


class TestHealth:
    async def test_health_endpoint(self, client: AsyncClient):
        """Health-Endpunkt antwortet mit ok."""
        import asyncio
        await asyncio.sleep(0.1)  # Connection-Pool stabilisieren
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ok", "degraded")
        assert "checks" in data
        assert "response_ms" in data

    async def test_health_has_db_check(self, client: AsyncClient):
        """Health-Endpunkt enthält DB-Status."""
        resp = await client.get("/api/health")
        assert "database" in resp.json()["checks"]
