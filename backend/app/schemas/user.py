from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.models.user import UserRole, UITheme, UILanguage


# ─── User anlegen (Admin) ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    display_name: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.AGENT


# ─── User bearbeiten ──────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    theme: Optional[UITheme] = None
    language: Optional[UILanguage] = None


# ─── User-Ausgabe (vollständig, für Admins) ───────────────────────────────────

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool
    is_onboarding: bool
    avatar_url: Optional[str] = None
    theme: UITheme
    language: UILanguage
    created_at: datetime
    updated_at: datetime


# ─── User-Kurzinfo (für Dropdowns) ────────────────────────────────────────────

class UserShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    role: UserRole
    avatar_url: Optional[str] = None


# ─── User-Liste ───────────────────────────────────────────────────────────────

class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
