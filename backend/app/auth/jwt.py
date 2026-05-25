from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT Access Token erstellen.
    subject = User-UUID als String.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """
    JWT Refresh Token erstellen (längere Laufzeit).
    Wird in Redis gespeichert und kann gezielt ungültig gemacht werden.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Token dekodieren und prüfen.
    Gibt das Payload-Dict zurück oder None bei ungültigem Token.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
