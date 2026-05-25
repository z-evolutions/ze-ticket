from fastapi import APIRouter, Depends
from app.auth.dependencies import require_admin
from app.models.user import User
from app.mail.poller import poll_once, poll_status

router = APIRouter(prefix="/api/email", tags=["E-Mail"])


@router.get("/status")
async def email_status(current_user: User = Depends(require_admin)):
    """Aktueller Status des IMAP-Pollers."""
    return poll_status


@router.post("/poll")
async def manual_poll(current_user: User = Depends(require_admin)):
    """Manueller Poll-Trigger (für Tests und Admin-Panel)."""
    count = await poll_once()
    return {
        "message": f"{count} Mail(s) verarbeitet.",
        "processed": count,
    }
