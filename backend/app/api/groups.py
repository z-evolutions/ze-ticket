from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.group import Group
from app.schemas.group import (
    GroupCreate, GroupUpdate, GroupResponse, GroupListResponse, MemberUpdate
)

router = APIRouter(prefix="/api/groups", tags=["Gruppen"])


# ─── GET /api/groups/ ─────────────────────────────────────────────────────────

@router.get("/", response_model=GroupListResponse)
async def list_groups(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Group).options(selectinload(Group.members))
    if is_active is not None:
        stmt = stmt.where(Group.is_active == is_active)
    stmt = stmt.order_by(Group.name)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar()

    result = await db.execute(stmt)
    groups = result.scalars().all()

    return GroupListResponse(groups=list(groups), total=total)


# ─── GET /api/groups/{group_id} ───────────────────────────────────────────────

@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden.")
    return group


# ─── POST /api/groups/ ────────────────────────────────────────────────────────

@router.post("/", response_model=GroupResponse, status_code=201)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Name-Duplikat prüfen
    existing = await db.execute(select(Group).where(Group.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Gruppenname bereits vergeben.")

    group = Group(
        name=data.name,
        description=data.description,
        email=data.email,
    )
    db.add(group)
    await db.commit()

    result = await db.execute(
        select(Group).where(Group.id == group.id).options(selectinload(Group.members))
    )
    return result.scalar_one()


# ─── PATCH /api/groups/{group_id} ────────────────────────────────────────────

@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.commit()

    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    return result.scalar_one()


# ─── POST /api/groups/{group_id}/members ─────────────────────────────────────

@router.post("/{group_id}/members", response_model=GroupResponse)
async def update_members(
    group_id: UUID,
    data: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden.")

    user_result = await db.execute(select(User).where(User.id == data.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")

    if data.action == "add":
        if user not in group.members:
            group.members.append(user)
    elif data.action == "remove":
        if user in group.members:
            group.members.remove(user)
            # Tickets des Agenten in dieser Gruppe freigeben
            from app.models.ticket import Ticket, TicketStatus
            tickets_stmt = select(Ticket).where(
                Ticket.assigned_group_id == group_id,
                Ticket.assigned_agent_id == data.user_id,
                Ticket.status.not_in([TicketStatus.GELOEST, TicketStatus.GESCHLOSSEN]),
            )
            tickets_result = await db.execute(tickets_stmt)
            affected_tickets = tickets_result.scalars().all()
            for ticket in affected_tickets:
                ticket.assigned_agent_id = None
                # System-Notiz erstellen
                from app.models.ticket import Comment, CommentType
                import uuid
                note = Comment(
                    id=uuid.uuid4(),
                    ticket_id=ticket.id,
                    author_id=current_user.id,
                    content=f"Agent wurde aus Gruppe '{group.name}' entfernt — Ticket-Zuweisung aufgehoben.",
                    comment_type=CommentType.INTERNE_NOTIZ,
                )
                db.add(note)
            if affected_tickets:
                print(f"[GROUPS] {len(affected_tickets)} Ticket(s) freigegeben nach Gruppen-Entfernung")
    else:
        raise HTTPException(status_code=400, detail="Aktion muss 'add' oder 'remove' sein.")

    await db.commit()

    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    return result.scalar_one()
