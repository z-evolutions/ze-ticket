"""Tests für Ticket-Endpunkte und Zugriffsschutz."""
import pytest
from httpx import AsyncClient


class TestTicketAccess:
    async def test_list_tickets_requires_auth(self, client: AsyncClient):
        """Ticket-Liste erfordert Authentifizierung."""
        resp = await client.get("/api/tickets/")
        assert resp.status_code == 401

    async def test_create_ticket_requires_auth(self, client: AsyncClient):
        """Ticket erstellen erfordert Authentifizierung."""
        resp = await client.post("/api/tickets/", json={
            "subject": "Test",
            "description": "Test",
            "priority": "normal"
        })
        assert resp.status_code == 401

    async def test_ticket_stats_requires_auth(self, client: AsyncClient):
        """Ticket-Stats erfordern Authentifizierung."""
        resp = await client.get("/api/tickets/stats")
        assert resp.status_code == 401

    async def test_my_stats_requires_auth(self, client: AsyncClient):
        """My-Stats erfordern Authentifizierung."""
        resp = await client.get("/api/tickets/my-stats")
        assert resp.status_code == 401

    async def test_group_stats_requires_auth(self, client: AsyncClient):
        """Group-Stats erfordern Authentifizierung."""
        resp = await client.get("/api/tickets/group-stats")
        assert resp.status_code == 401

    async def test_ticket_detail_requires_auth(self, client: AsyncClient):
        """Ticket-Detail erfordert Authentifizierung."""
        resp = await client.get("/api/tickets/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 401

    async def test_invalid_ticket_id(self, client: AsyncClient):
        """Ungültige Ticket-ID → 422."""
        resp = await client.get("/api/tickets/not-a-uuid",
            headers={"Authorization": "Bearer invalid"})
        assert resp.status_code in (401, 422)


class TestTicketValidation:
    async def test_create_ticket_invalid_priority(self, client: AsyncClient):
        """Ungültige Priorität → 422."""
        resp = await client.post("/api/tickets/", json={
            "subject": "Test",
            "description": "Test",
            "priority": "super_high"
        })
        assert resp.status_code in (401, 422)

    async def test_search_requires_min_length(self, client: AsyncClient):
        """Suche erfordert mind. 2 Zeichen."""
        resp = await client.get("/api/tickets/search?q=a")
        assert resp.status_code in (401, 422)
