import uuid
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis

from app.core.database import get_db
from app.core.config import settings
from app.core.ratelimit import check_rate_limit
from app.models.user import User
from app.auth.password import (
    verify_password,
    hash_password,
    generate_onboarding_password,
    validate_password_policy,
)
from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.auth.dependencies import get_current_user
from app.mail.service import send_password_reset_mail
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    OnboardingRequest,
    PasswordResetRequestSchema,
    PasswordResetConfirmSchema,
    RefreshRequest,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ─── Redis-Verbindung ──────────────────────────────────────────────────────────

async def get_redis():
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


# ─── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Rate Limit: 5 Versuche pro IP in 15 Minuten
    client_ip = request.client.host
    await check_rate_limit(
        redis,
        key=f"login:{client_ip}",
        limit=5,
        window=900,
        detail="Zu viele Login-Versuche. Bitte 15 Minuten warten.",
    )

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-Mail oder Passwort falsch.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deaktiviert. Bitte Admin kontaktieren.",
        )

    if user.is_onboarding:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bitte zuerst das Einmalpasswort ändern.",
            headers={"X-Requires-Onboarding": "true"},
        )

    # Bei erfolgreichem Login: Zähler zurücksetzen
    await redis.delete(f"ratelimit:login:{client_ip}")

    user_id = str(user.id)
    access_token = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)

    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await redis.setex(f"refresh:{user_id}", ttl, refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ─── Onboarding ────────────────────────────────────────────────────────────────

@router.post("/onboarding", response_model=TokenResponse)
async def onboarding(
    request: Request,
    data: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Rate Limit: 10 Versuche pro IP in 15 Minuten
    await check_rate_limit(
        redis,
        key=f"onboarding:{request.client.host}",
        limit=10,
        window=900,
        detail="Zu viele Versuche. Bitte 15 Minuten warten.",
    )

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user is None or not user.is_onboarding:
        raise HTTPException(status_code=400, detail="Ungültige Anfrage.")

    if not verify_password(data.onboarding_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Einmalpasswort falsch.")

    user.hashed_password = hash_password(data.new_password)
    user.is_onboarding = False
    user.onboarding_token = None
    await db.commit()

    user_id = str(user.id)
    access_token = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)

    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await redis.setex(f"refresh:{user_id}", ttl, refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ─── Token erneuern ────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Ungültiger Refresh-Token.")

    user_id = payload.get("sub")

    stored = await redis.get(f"refresh:{user_id}")
    if stored != data.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh-Token ungültig oder abgelaufen.")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User nicht gefunden.")

    new_access = create_access_token(subject=user_id)
    new_refresh = create_refresh_token(subject=user_id)

    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await redis.setex(f"refresh:{user_id}", ttl, new_refresh)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


# ─── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    data: RefreshRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    payload = decode_token(data.refresh_token)
    if payload:
        user_id = payload.get("sub")
        await redis.delete(f"refresh:{user_id}")
    return {"detail": "Erfolgreich ausgeloggt."}


# ─── Passwort-Reset anfordern ──────────────────────────────────────────────────

@router.post("/password-reset/request")
async def request_password_reset(
    request: Request,
    data: PasswordResetRequestSchema,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Rate Limit: 3 Versuche pro IP in 30 Minuten
    await check_rate_limit(
        redis,
        key=f"pwreset:{request.client.host}",
        limit=3,
        window=1800,
        detail="Zu viele Anfragen. Bitte 30 Minuten warten.",
    )

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        await redis.setex(f"reset:{token}", 1800, str(user.id))
        await send_password_reset_mail(
            to_email=user.email,
            display_name=user.display_name,
            reset_token=token,
            expires_minutes=30,
        )

    return {"detail": "Falls die E-Mail existiert, wurde ein Reset-Link gesendet."}


# ─── Passwort-Reset bestätigen ─────────────────────────────────────────────────

@router.post("/password-reset/confirm")
async def confirm_password_reset(
    data: PasswordResetConfirmSchema,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    user_id = await redis.get(f"reset:{data.token}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Token ungültig oder abgelaufen.")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User nicht gefunden.")

    user.hashed_password = hash_password(data.new_password)
    user.is_onboarding = False
    await db.commit()

    await redis.delete(f"reset:{data.token}")

    return {"detail": "Passwort erfolgreich geändert."}


# ─── Me ───────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "language": getattr(current_user, "language", "de"),
        "theme": getattr(current_user, "theme", "dark"),
    }
