from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    email: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class MemberShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    display_name: str
    role: str
    avatar_url: Optional[str] = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    members: list[MemberShort] = []


class GroupListResponse(BaseModel):
    groups: list[GroupResponse]
    total: int


class MemberUpdate(BaseModel):
    user_id: UUID
    action: str  # "add" oder "remove"
