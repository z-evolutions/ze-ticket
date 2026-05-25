from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
import os
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
import logging

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.auth.password import hash_password, generate_onboarding_password, verify_password, validate_password_policy
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserShort, UserListResponse
from app.mail.service import send_invitation_mail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["Benutzerverwaltung"])


@router.get("/", response_model=UserListResponse)
async def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar()

    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    users = result.scalars().all()

    return UserListResponse(users=list(users), total=total)


@router.get("/agents", response_model=list[UserShort])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(User).where(
        User.is_active == True,
        User.role.in_([UserRole.AGENT, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN])
    ).order_by(User.display_name)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="E-Mail-Adresse bereits vergeben.")

    if data.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Nur Superadmins können Superadmins anlegen.")

    onboarding_password = generate_onboarding_password()

    user = User(
        email=data.email,
        display_name=data.display_name,
        full_name=data.full_name,
        role=data.role,
        hashed_password=hash_password(onboarding_password),
        is_onboarding=True,
        onboarding_token=onboarding_password,
        is_active=True,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    try:
        await send_invitation_mail(
            to_email=user.email,
            display_name=user.display_name,
            role=user.role.value,
            onboarding_password=onboarding_password,
        )
        logger.info(f"[MAIL] Einladungsmail → {user.email}")
    except Exception as e:
        logger.error(f"[MAIL] Einladungsmail fehlgeschlagen für {user.email}: {e}")

    return user


# ─── GET /api/users/me ────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Eigenes Profil abrufen."""
    return current_user


# ─── PATCH /api/users/me ─────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    theme: Optional[str] = None
    language: Optional[str] = None

@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eigenes Profil aktualisieren."""
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.theme is not None:
        current_user.theme = data.theme
    if data.language is not None:
        current_user.language = data.language
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ─── POST /api/users/me/avatar ────────────────────────────────────────────────

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Avatar hochladen — max. 2MB, nur Bilder."""
    # Typ prüfen
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Nur JPEG, PNG, WebP oder GIF erlaubt.")

    # Größe prüfen (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu groß. Maximum: 2MB.")

    # Alten Avatar löschen
    if current_user.avatar_url:
        old_path = f"/app{current_user.avatar_url}"
        if os.path.exists(old_path):
            os.remove(old_path)

    # Neuen Avatar speichern
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{current_user.id}.{ext}"
    filepath = f"/app/uploads/avatars/{filename}"

    with open(filepath, "wb") as f:
        f.write(contents)

    # URL in DB speichern
    current_user.avatar_url = f"/uploads/avatars/{filename}"
    await db.commit()
    await db.refresh(current_user)

    return {"avatar_url": current_user.avatar_url}


# ─── POST /api/users/me/password ─────────────────────────────────────────────

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/me/password")
async def change_my_password(
    data: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eigenes Passwort ändern."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort falsch.")

    error = validate_password_policy(data.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()

    return {"detail": "Passwort erfolgreich geändert."}
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")

    if user.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin kann nur von Superadmin bearbeitet werden.")

    if data.is_active is False and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst deaktivieren.")

    # ── Reaktivierung: Einladungsmail wenn User noch im Onboarding ────────────
    was_inactive = not user.is_active
    reactivated = was_inactive and data.is_active is True

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    if reactivated and user.is_onboarding and user.onboarding_token:
        try:
            await send_invitation_mail(
                to_email=user.email,
                display_name=user.display_name,
                role=user.role.value,
                onboarding_password=user.onboarding_token,
            )
            logger.info(f"[MAIL] Reaktivierungs-Einladungsmail → {user.email}")
        except Exception as e:
            logger.error(f"[MAIL] Reaktivierungs-Mail fehlgeschlagen für {user.email}: {e}")

    return user


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")

    new_password = generate_onboarding_password()
    user.hashed_password = hash_password(new_password)
    user.is_onboarding = True
    user.onboarding_token = new_password

    await db.commit()

    try:
        await send_invitation_mail(
            to_email=user.email,
            display_name=user.display_name,
            role=user.role.value,
            onboarding_password=new_password,
        )
        logger.info(f"[MAIL] Reset-Mail → {user.email}")
    except Exception as e:
        logger.error(f"[MAIL] Reset-Mail fehlgeschlagen für {user.email}: {e}")

    return {
        "message": "Passwort zurückgesetzt. Einladungsmail wurde versendet.",
        "dev_password": new_password
    }


