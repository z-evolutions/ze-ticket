"""
WebSocket Connection Manager.
Verwaltet alle aktiven WebSocket-Verbindungen und broadcastet Events.
"""
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # { user_id: [WebSocket, ...] }
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(websocket)
        logger.info(f"[WS] User {user_id} verbunden. Aktive Verbindungen: {self.total_connections}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id].discard(websocket) if hasattr(self.connections[user_id], 'discard') else None
            try:
                self.connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self.connections[user_id]:
                del self.connections[user_id]
        logger.info(f"[WS] User {user_id} getrennt. Aktive Verbindungen: {self.total_connections}")

    @property
    def total_connections(self) -> int:
        return sum(len(v) for v in self.connections.values())

    async def send_to_user(self, user_id: str, event: dict):
        """Sendet ein Event an einen bestimmten User."""
        if user_id in self.connections:
            dead = []
            for ws in self.connections[user_id]:
                try:
                    await ws.send_json(event)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, user_id)

    async def broadcast(self, event: dict):
        """Sendet ein Event an alle verbundenen User."""
        dead_pairs = []
        for user_id, sockets in self.connections.items():
            for ws in sockets:
                try:
                    await ws.send_json(event)
                except Exception:
                    dead_pairs.append((ws, user_id))
        for ws, user_id in dead_pairs:
            self.disconnect(ws, user_id)


# Singleton — wird überall per Import genutzt
manager = ConnectionManager()


# ─── Event-Helfer ─────────────────────────────────────────────────────────────

async def broadcast_ticket_update(ticket_id: str, ticket_number: str, action: str, data: dict = {}):
    """Ticket wurde erstellt/geändert."""
    await manager.broadcast({
        "type": "ticket_update",
        "action": action,  # "created", "updated", "status_changed"
        "ticket_id": ticket_id,
        "ticket_number": ticket_number,
        **data,
    })


async def broadcast_new_comment(ticket_id: str, ticket_number: str, comment_type: str, assigned_agent_id: str = None, author_id: str = None):
    """Neuer Kommentar wurde hinzugefügt."""
    await manager.broadcast({
        "type": "new_comment",
        "ticket_id": ticket_id,
        "ticket_number": ticket_number,
        "comment_type": comment_type,
        "data": {"assigned_agent_id": assigned_agent_id, "author_id": author_id},
    })


async def broadcast_stats_update():
    """Stats haben sich geändert — Dashboard neu laden."""
    await manager.broadcast({
        "type": "stats_update",
    })


async def broadcast_agent_presence(ticket_id: str, agent_name: str, online: bool):
    """Agent hat Ticket geöffnet/geschlossen."""
    await manager.broadcast({
        "type": "agent_joined" if online else "agent_left",
        "ticket_id": ticket_id,
        "agent_name": agent_name,
    })
