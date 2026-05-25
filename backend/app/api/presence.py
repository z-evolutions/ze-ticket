from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.websocket.manager import broadcast_agent_presence

router = APIRouter(prefix="/api/tickets", tags=["Präsenz"])


class PresenceUpdate(BaseModel):
    ticket_id: str
    online: bool


@router.post("/presence")
async def update_presence(
    data: PresenceUpdate,
    current_user: User = Depends(get_current_user),
):
    """Agent meldet Präsenz im Ticket — broadcastet an alle Verbundenen."""
    await broadcast_agent_presence(
        ticket_id=data.ticket_id,
        agent_name=current_user.display_name,
        online=data.online,
    )
    return {"ok": True}
