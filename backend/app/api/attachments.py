"""
Dateianhänge API — Upload, Download, Löschen.
"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_agent
from app.models.ticket import Attachment, Ticket
from app.models.user import User

router = APIRouter(prefix="/api/attachments", tags=["Anhänge"])

UPLOAD_DIR = "/app/uploads/attachments"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── POST /api/attachments/upload ─────────────────────────────────────────────

@router.post("/upload")
async def upload_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    comment_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datei hochladen und an Ticket (+ optional Kommentar) hängen."""

    # Ticket prüfen
    result = await db.execute(select(Ticket).where(Ticket.id == uuid.UUID(ticket_id)))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden.")

    # Dateityp prüfen
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Dateityp nicht erlaubt: {file.content_type}")

    # Dateigröße prüfen
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Datei zu groß. Maximum: 10MB.")

    # Datei speichern
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    stored_filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, stored_filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    # DB-Eintrag
    attachment = Attachment(
        ticket_id=uuid.UUID(ticket_id),
        comment_id=uuid.UUID(comment_id) if comment_id else None,
        uploaded_by_id=current_user.id,
        filename=file.filename,
        stored_filename=stored_filename,
        mimetype=file.content_type,
        filesize=len(contents),
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {
        "id": str(attachment.id),
        "filename": attachment.filename,
        "mimetype": attachment.mimetype,
        "filesize": attachment.filesize,
        "url": f"/api/attachments/{attachment.id}/download",
    }


# ─── GET /api/attachments/{id}/download ───────────────────────────────────────

@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datei herunterladen."""
    result = await db.execute(
        select(Attachment).where(Attachment.id == uuid.UUID(attachment_id))
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden.")

    filepath = os.path.join(UPLOAD_DIR, attachment.stored_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden.")

    from urllib.parse import quote
    safe_filename = quote(attachment.filename)
    return FileResponse(
        filepath,
        media_type=attachment.mimetype,
        filename=attachment.filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"
        }
    )


# ─── GET /api/attachments/ticket/{ticket_id} ──────────────────────────────────

@router.get("/ticket/{ticket_id}")
async def list_attachments(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alle Anhänge eines Tickets abrufen."""
    result = await db.execute(
        select(Attachment).where(Attachment.ticket_id == uuid.UUID(ticket_id))
        .order_by(Attachment.created_at)
    )
    attachments = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "filename": a.filename,
            "mimetype": a.mimetype,
            "filesize": a.filesize,
            "url": f"/api/attachments/{a.id}/download",
            "created_at": a.created_at.isoformat(),
        }
        for a in attachments
    ]


# ─── DELETE /api/attachments/{id} ─────────────────────────────────────────────

@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent),
):
    """Anhang löschen — nur Agenten."""
    result = await db.execute(
        select(Attachment).where(Attachment.id == uuid.UUID(attachment_id))
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden.")

    # Datei löschen
    filepath = os.path.join(UPLOAD_DIR, attachment.stored_filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.delete(attachment)
    await db.commit()

    return {"detail": "Anhang gelöscht."}
