from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.auth.jwt import decode_token
from app.models.user import User, UserRole
from app.core.database import get_db

# FastAPI liest den Token automatisch aus dem Authorization-Header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency: Gibt den eingeloggten User zurück.
    Wirft 401 wenn Token ungültig oder User nicht gefunden.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültige oder abgelaufene Sitzung.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: Nur aktive User (kein Onboarding-Check)."""
    return current_user


async def require_agent(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: Mindestens Agent-Rolle erforderlich."""
    allowed = {UserRole.AGENT, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN}
    if current_user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung.")
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: Mindestens Admin-Rolle erforderlich."""
    allowed = {UserRole.ADMIN, UserRole.SUPERADMIN}
    if current_user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung.")
    return current_user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: Nur Superadmin."""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung.")
    return current_user

async def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: Nur Kunden-Rolle."""
    if current_user.role != UserRole.KUNDE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nur für Kunden.")
    return current_user
