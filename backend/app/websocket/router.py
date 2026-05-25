from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.auth.jwt import decode_token
from app.websocket.manager import manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/tickets")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket-Endpunkt für Echtzeit-Updates.
    Token wird als Query-Parameter übergeben: /ws/tickets?token=...
    """
    # Token validieren
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user_id)

    try:
        # Verbindung bestätigen
        await websocket.send_json({
            "type": "connected",
            "message": "Echtzeit-Updates aktiv"
        })

        # Verbindung offen halten — auf Ping/Pong warten
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
