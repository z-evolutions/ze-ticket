from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import redis.asyncio as aioredis

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.ticket import Ticket
from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.password import verify_password

router = APIRouter(prefix="/api/auth", tags=["Kunden-Auth"])


async def get_redis():
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    ticket_number: str
    password: str


@router.post("/customer-login")
async def customer_login(
    data: CustomerLoginRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Kunden-Login über E-Mail + Ticket-Nummer + Passwort."""

    # User suchen
    result = await db.execute(
        select(User).where(
            User.email == data.email.lower(),
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-Mail, Ticket-Nummer oder Passwort ungültig.",
        )

    # Passwort prüfen
    if not user.hashed_password or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-Mail, Ticket-Nummer oder Passwort ungültig.",
        )

    # Ticket-Nummer prüfen — muss dem User gehören
    ticket_result = await db.execute(
        select(Ticket).where(
            Ticket.ticket_number == data.ticket_number.upper().strip(),
            Ticket.created_by_id == user.id,
        )
    )
    ticket = ticket_result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-Mail, Ticket-Nummer oder Passwort ungültig.",
        )

    # Token erstellen
    user_id = str(user.id)
    access_token  = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)

    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await redis.setex(f"refresh:{user_id}", ttl, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "redirect_ticket_id": str(ticket.id),
    }
