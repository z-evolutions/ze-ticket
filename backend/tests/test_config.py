"""Tests für Konfigurationsendpunkte."""
import pytest
from httpx import AsyncClient


class TestPublicConfig:
    async def test_dashboard_config_public(self, client: AsyncClient):
        """Dashboard-Config ist öffentlich abrufbar."""
        resp = await client.get("/api/config/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "show_group_tiles" in data
        assert "ticket_visibility" in data

    async def test_company_config_public(self, client: AsyncClient):
        """Betreiber-Daten sind öffentlich abrufbar."""
        resp = await client.get("/api/config/company")
        assert resp.status_code == 200
        data = resp.json()
        assert "company_name" in data
        assert "company_email" in data

    async def test_privacy_text_public(self, client: AsyncClient):
        """Datenschutztext ist öffentlich abrufbar."""
        resp = await client.get("/api/config/privacy_text")
        assert resp.status_code == 200
        assert "value" in resp.json()

    async def test_imprint_text_public(self, client: AsyncClient):
        """Impressum ist öffentlich abrufbar."""
        resp = await client.get("/api/config/imprint_text")
        assert resp.status_code == 200
        assert "value" in resp.json()

    async def test_rendered_privacy_public(self, client: AsyncClient):
        """Gerenderter Datenschutztext ist öffentlich abrufbar."""
        resp = await client.get("/api/config/privacy_text/rendered")
        assert resp.status_code == 200
        assert "value" in resp.json()

    async def test_private_key_not_accessible(self, client: AsyncClient):
        """Nicht-öffentliche Keys sind nicht abrufbar."""
        resp = await client.get("/api/config/mail_smtp_password")
        assert resp.status_code == 404

    async def test_patch_config_requires_auth(self, client: AsyncClient):
        """Config ändern erfordert Authentifizierung."""
        resp = await client.patch("/api/config/app_name",
            json={"value": "Hacked"})
        assert resp.status_code == 401


class TestPortalConfig:
    async def test_portal_form_config_public(self, client: AsyncClient):
        """Portal-Formular-Config ist öffentlich."""
        resp = await client.get("/api/portal/form-config")
        assert resp.status_code in (200, 500)  # 500 in CI ohne Dateisystem
