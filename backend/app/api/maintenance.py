"""
Maintenance-Checkliste — gespeichert als JSON-Datei auf dem Server.
Nur für Superadmins zugänglich.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import json
import os

from app.auth.dependencies import require_superadmin
from app.models.user import User

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])

CHECKLIST_FILE = "/app/data/checklist.json"


def _load() -> dict:
    os.makedirs(os.path.dirname(CHECKLIST_FILE), exist_ok=True)
    if not os.path.exists(CHECKLIST_FILE):
        return {}
    with open(CHECKLIST_FILE, "r") as f:
        return json.load(f)


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(CHECKLIST_FILE), exist_ok=True)
    with open(CHECKLIST_FILE, "w") as f:
        json.dump(data, f, indent=2)


class ChecklistUpdate(BaseModel):
    key: str
    checked: bool


@router.get("/")
async def get_checklist(current_user: User = Depends(require_superadmin)):
    return _load()


@router.patch("/")
async def update_checklist(
    data: ChecklistUpdate,
    current_user: User = Depends(require_superadmin),
):
    checklist = _load()
    checklist[data.key] = data.checked
    _save(checklist)
    return checklist
