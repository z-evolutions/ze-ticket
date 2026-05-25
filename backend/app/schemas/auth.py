from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.auth.password import validate_password_policy


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class OnboardingRequest(BaseModel):
    """Erstanmeldung: Einmalpasswort + neues Passwort setzen."""
    email: EmailStr
    onboarding_password: str
    new_password: str
    new_password_confirm: str

    @field_validator("new_password")
    @classmethod
    def password_policy(cls, v):
        valid, msg = validate_password_policy(v)
        if not valid:
            raise ValueError(msg)
        return v

    @field_validator("new_password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwörter stimmen nicht überein.")
        return v


class PasswordResetRequestSchema(BaseModel):
    """Schritt 1: E-Mail eingeben für Reset-Link."""
    email: EmailStr


class PasswordResetConfirmSchema(BaseModel):
    """Schritt 2: Token + neues Passwort."""
    token: str
    new_password: str
    new_password_confirm: str

    @field_validator("new_password")
    @classmethod
    def password_policy(cls, v):
        valid, msg = validate_password_policy(v)
        if not valid:
            raise ValueError(msg)
        return v

    @field_validator("new_password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwörter stimmen nicht überein.")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    ticket_number: str


class TokenResponseWithRedirect(TokenResponse):
    redirect_ticket_id: Optional[str] = None

