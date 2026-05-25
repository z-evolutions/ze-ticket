from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.user import User, UserRole, UITheme, UILanguage
from app.auth.password import hash_password

router = APIRouter(prefix="/api/setup", tags=["Setup"])


async def _superadmin_exists(db: AsyncSession) -> bool:
    result = await db.execute(
        select(func.count()).where(User.role == UserRole.SUPERADMIN)
    )
    return result.scalar() > 0


# ─── GET /api/setup/status ────────────────────────────────────────────────────

@router.get("/status")
async def setup_status(db: AsyncSession = Depends(get_db)):
    """Öffentlich — prüft ob Setup erforderlich ist."""
    needs_setup = not await _superadmin_exists(db)
    return {"setup_required": needs_setup}


# ─── POST /api/setup/create-admin ─────────────────────────────────────────────

class SetupRequest(BaseModel):
    email: EmailStr
    display_name: str
    full_name: str
    password: str
    password_confirm: str


@router.post("/create-admin", status_code=201)
async def create_admin(
    data: SetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Öffentlich — aber nur ausführbar wenn kein Superadmin existiert.
    Legt den ersten Superadmin an.
    """
    # Sicherheit: nur wenn kein Superadmin existiert
    if await _superadmin_exists(db):
        raise HTTPException(
            status_code=403,
            detail="Setup bereits abgeschlossen. Kein Zugriff."
        )

    if data.password != data.password_confirm:
        raise HTTPException(status_code=400, detail="Passwörter stimmen nicht überein.")

    from app.auth.password import validate_password_policy
    valid, msg = validate_password_policy(data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Superadmin anlegen
    admin = User(
        email=data.email.lower(),
        display_name=data.display_name,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.SUPERADMIN,
        is_active=True,
        is_onboarding=False,
        theme=UITheme.DARK,
        language=UILanguage.DE,
    )
    db.add(admin)
    await db.commit()

    return {
        "message": "Superadmin erfolgreich angelegt. Bitte einloggen.",
        "email": data.email,
    }
