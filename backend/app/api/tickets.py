from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
import datetime

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority, Comment, CommentType
from app.websocket.manager import broadcast_ticket_update, broadcast_stats_update
from app.schemas.ticket import (
    TicketCreate, TicketUpdate,
    TicketResponse, TicketDetailResponse, TicketListResponse, TicketStats
)
from app.search.client import get_es_client
from app.core.sla_service import assign_sla
from app.search.tickets import index_ticket, search_tickets

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


# ─── Hilfsfunktion: Ticket-Nummer generieren ──────────────────────────────────

async def generate_ticket_number(db: AsyncSession) -> tuple[str, int, int]:
    year = datetime.datetime.now().year
    result = await db.execute(
        select(func.max(Ticket.sequence)).where(Ticket.year == year)
    )
    last = result.scalar()
    sequence = (last or 0) + 1
    ticket_number = f"ZE-{year}-{sequence:04d}"
    return ticket_number, year, sequence


# ─── Hilfsfunktion: System-Notiz anlegen ──────────────────────────────────────

async def create_system_note(db: AsyncSession, ticket_id, author_id, text: str):
    note = Comment(
        ticket_id=ticket_id,
        author_id=author_id,
        content=text,
        comment_type=CommentType.INTERNE_NOTIZ,
    )
    db.add(note)


# ─── GET /api/tickets/ ────────────────────────────────────────────────────────

# ─── Hilfsfunktion: Ticket-Sichtbarkeitsfilter ───────────────────────────────
async def get_visibility_filter(db, current_user):
    """Gibt den SQLAlchemy-Filter für die Ticket-Sichtbarkeit zurück."""
    from app.api.config import get_config_value
    from app.models.group import Group

    # Admins/Manager sehen immer alles
    if current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER):
        return None

    # Kunden sehen nur eigene Tickets
    if current_user.role == UserRole.KUNDE:
        return Ticket.created_by_id == current_user.id

    # Agenten: Sichtbarkeit aus Config lesen
    visibility = await get_config_value(db, "ticket_visibility")

    if visibility == "all":
        return None

    elif visibility == "own_and_unassigned":
        from sqlalchemy import or_
        from app.models.user import user_group_association
        # Gruppen des Agenten ermitteln
        group_stmt = select(user_group_association.c.group_id).where(
            user_group_association.c.user_id == current_user.id
        )
        group_result = await db.execute(group_stmt)
        group_ids = [r[0] for r in group_result.fetchall()]
        return or_(
            # Mir zugewiesen
            Ticket.assigned_agent_id == current_user.id,
            # Kein Agent + keine Gruppe
            (Ticket.assigned_agent_id == None) & (Ticket.assigned_group_id == None),
            # Kein Agent + meine Gruppe
            (Ticket.assigned_agent_id == None) & (Ticket.assigned_group_id.in_(group_ids)),
        )

    elif visibility == "own_group":
        from sqlalchemy import or_
        # Gruppen des Agenten ermitteln
        from app.models.user import user_group_association
        group_stmt = select(user_group_association.c.group_id).where(
            user_group_association.c.user_id == current_user.id
        )
        group_result = await db.execute(group_stmt)
        group_ids = [r[0] for r in group_result.fetchall()]
        return or_(
            Ticket.assigned_agent_id == current_user.id,
            Ticket.assigned_agent_id == None,
            Ticket.assigned_group_id.in_(group_ids),
        )

    return None



# ─── GET /api/tickets/ ────────────────────────────────────────────────────────
@router.get("/", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    assigned_to_me: bool = False,
    unassigned: bool = False,
    unassigned_for_me: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Ticket).options(selectinload(Ticket.assigned_agent))

    # Sichtbarkeitsfilter anwenden
    vis_filter = await get_visibility_filter(db, current_user)
    if vis_filter is not None:
        stmt = stmt.where(vis_filter)

    if status:
        stmt = stmt.where(Ticket.status == status)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)
    if assigned_to_me:
        stmt = stmt.where(Ticket.assigned_agent_id == current_user.id)
    if unassigned:
        stmt = stmt.where(Ticket.assigned_agent_id == None)
    if unassigned_for_me:
        from sqlalchemy import or_
        from app.models.user import user_group_association
        # Gruppen des aktuellen Nutzers
        group_stmt = select(user_group_association.c.group_id).where(
            user_group_association.c.user_id == current_user.id
        )
        group_result = await db.execute(group_stmt)
        group_ids = [r[0] for r in group_result.fetchall()]
        stmt = stmt.where(Ticket.assigned_agent_id == None)
        stmt = stmt.where(
            or_(
                Ticket.assigned_group_id == None,
                Ticket.assigned_group_id.in_(group_ids),
            )
        )

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar()

    stmt = stmt.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    tickets = result.scalars().all()

    return TicketListResponse(tickets=list(tickets), total=total, page=page, page_size=page_size)


# ─── GET /api/tickets/stats ───────────────────────────────────────────────────

@router.get("/stats", response_model=TicketStats)
async def ticket_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async def count(extra_filter=None) -> int:
        stmt = select(func.count(Ticket.id))
        if current_user.role == UserRole.KUNDE:
            stmt = stmt.where(Ticket.created_by_id == current_user.id)
        if extra_filter is not None:
            stmt = stmt.where(extra_filter)
        result = await db.execute(stmt)
        return result.scalar()

    return TicketStats(
        total=await count(),
        neu=await count(Ticket.status == TicketStatus.NEU),
        in_bearbeitung=await count(Ticket.status == TicketStatus.IN_BEARBEITUNG),
        geloest=await count(Ticket.status == TicketStatus.GELOEST),
        geschlossen=await count(Ticket.status == TicketStatus.GESCHLOSSEN),
        meine_tickets=await count(Ticket.assigned_agent_id == current_user.id),
        sla_breached=await count(Ticket.sla_breached == True),
    )


# ─── GET /api/tickets/search ─────────────────────────────────────────────────
# MUSS vor /{ticket_id} stehen, sonst matcht FastAPI "search" als UUID

@router.get("/search")
async def search(
    q: str = Query(..., min_length=2, description="Suchbegriff"),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.KUNDE:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")

    es = get_es_client()
    results = await search_tickets(es, query=q, status=status, priority=priority)
    return {"query": q, "total": len(results), "results": results}



# ─── GET /api/tickets/my-stats ────────────────────────────────────────────────
@router.get("/my-stats")
async def my_ticket_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persönliche Agent-KPIs für das Dashboard."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func, case

    if current_user.role == UserRole.KUNDE:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")

    async def count(filter) -> int:
        result = await db.execute(select(func.count(Ticket.id)).where(filter))
        return result.scalar() or 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Ø Bearbeitungszeit (gelöste Tickets des Agenten)
    resolved = await db.execute(
        select(Ticket.created_at, Ticket.updated_at)
        .where(Ticket.assigned_agent_id == current_user.id)
        .where(Ticket.status.in_([TicketStatus.GELOEST, TicketStatus.GESCHLOSSEN]))
    )
    resolved_rows = resolved.fetchall()
    if resolved_rows:
        durations = [(r.updated_at - r.created_at).total_seconds() / 3600 for r in resolved_rows]
        avg_hours = round(sum(durations) / len(durations), 1)
    else:
        avg_hours = 0

    # SLA-Rate (meine Tickets)
    my_total_sla = await count(
        (Ticket.assigned_agent_id == current_user.id) & (Ticket.sla_id.isnot(None))
    )
    my_breached = await count(
        (Ticket.assigned_agent_id == current_user.id) & (Ticket.sla_breached == True)
    )
    sla_rate = round((1 - my_breached / my_total_sla) * 100, 1) if my_total_sla > 0 else 100.0

    return {
        "my_open":        await count((Ticket.assigned_agent_id == current_user.id) & (Ticket.status.in_([TicketStatus.NEU, TicketStatus.IN_BEARBEITUNG]))),
        "my_critical":    await count((Ticket.assigned_agent_id == current_user.id) & (Ticket.priority == TicketPriority.KRITISCH) & (Ticket.status != TicketStatus.GESCHLOSSEN)),
        "my_high":        await count((Ticket.assigned_agent_id == current_user.id) & (Ticket.priority == TicketPriority.HOCH) & (Ticket.status != TicketStatus.GESCHLOSSEN)),
        "unassigned":     await count((Ticket.assigned_agent_id == None) & (Ticket.status == TicketStatus.NEU)),
        "resolved_today": await count((Ticket.assigned_agent_id == current_user.id) & (Ticket.status.in_([TicketStatus.GELOEST, TicketStatus.GESCHLOSSEN])) & (Ticket.updated_at >= today_start)),
        "avg_hours":      avg_hours,
        "sla_rate":       sla_rate,
        "sla_breached":   my_breached,
    }


# ─── GET /api/tickets/group-stats ─────────────────────────────────────────────
@router.get("/group-stats")
async def group_ticket_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gruppen-Statistiken für das Dashboard."""
    from app.models.group import Group
    from app.models.user import user_group_association

    if current_user.role == UserRole.KUNDE:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")

    # Gruppen des Agenten ermitteln (Admins sehen alle)
    if current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MANAGER):
        groups_result = await db.execute(select(Group).where(Group.is_active == True))
    else:
        groups_result = await db.execute(
            select(Group)
            .join(user_group_association, Group.id == user_group_association.c.group_id)
            .where(user_group_association.c.user_id == current_user.id)
            .where(Group.is_active == True)
        )
    groups = groups_result.scalars().all()

    async def count_group(group_id, *filters):
        stmt = select(func.count(Ticket.id)).where(Ticket.assigned_group_id == group_id)
        for f in filters:
            stmt = stmt.where(f)
        return (await db.execute(stmt)).scalar() or 0

    result = []
    for group in groups:
        result.append({
            "id":          str(group.id),
            "name":        group.name,
            "open":        await count_group(group.id, Ticket.status.in_([TicketStatus.NEU, TicketStatus.IN_BEARBEITUNG])),
            "unassigned":  await count_group(group.id, Ticket.assigned_agent_id == None, Ticket.status == TicketStatus.NEU),
            "critical":    await count_group(group.id, Ticket.priority == TicketPriority.KRITISCH, Ticket.status != TicketStatus.GESCHLOSSEN),
            "sla_breached": await count_group(group.id, Ticket.sla_breached == True),
        })

    return result


# ─── GET /api/tickets/{ticket_id} ─────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.comments).selectinload(Comment.author),
        )
    )
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden.")
    if current_user.role == UserRole.KUNDE and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Ticket.")

    # Agenten: Zugriff nur wenn Ticket ihrer Gruppe gehört oder ihnen zugewiesen ist
    if current_user.role == UserRole.AGENT:
        if ticket.assigned_group_id is not None:
            from app.models.user import user_group_association
            group_check = await db.execute(
                select(user_group_association.c.group_id).where(
                    user_group_association.c.user_id == current_user.id,
                    user_group_association.c.group_id == ticket.assigned_group_id,
                )
            )
            in_group = group_check.scalar_one_or_none()
            is_assigned = ticket.assigned_agent_id == current_user.id
            if not in_group and not is_assigned:
                raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Ticket.")

    return ticket


# ─── PATCH /api/tickets/{ticket_id} ──────────────────────────────────────────

STATUS_LABELS = {
    "neu":            "Neu",
    "in_bearbeitung": "In Bearbeitung",
    "geloest":        "Gelöst",
    "geschlossen":    "Geschlossen",
}

PRIORITY_LABELS = {
    "niedrig":  "Niedrig",
    "normal":   "Normal",
    "hoch":     "Hoch",
    "kritisch": "Kritisch",
}

@router.post("/", response_model=TicketResponse, status_code=201)
async def create_ticket(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket_number, year, sequence = await generate_ticket_number(db)

    ticket = Ticket(
        ticket_number=ticket_number,
        year=year,
        sequence=sequence,
        subject=data.subject,
        description=data.description,
        priority=data.priority,
        tags=data.tags,
        channel="web",
        created_by_id=current_user.id,
        assigned_agent_id=data.assigned_agent_id,
        assigned_group_id=data.assigned_group_id,
    )

    db.add(ticket)
    await db.flush()  # ID vergeben

    # SLA automatisch zuweisen
    await assign_sla(db, ticket)
    await db.commit()

    # Relationen für ES laden
    await db.refresh(ticket)
    stmt_full = (
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(selectinload(Ticket.assigned_agent), selectinload(Ticket.created_by))
    )
    result_full = await db.execute(stmt_full)
    ticket_full = result_full.scalar_one()

    # ES indexieren (Fehler darf Backend nicht blockieren)
    try:
        await index_ticket(get_es_client(), ticket_full)
    except Exception:
        pass

    # WebSocket broadcast
    await broadcast_ticket_update(str(ticket.id), ticket.ticket_number, "created", {"priority": ticket.priority, "assigned_agent_id": str(ticket.assigned_agent_id) if ticket.assigned_agent_id else None})
    await broadcast_stats_update()

    return ticket


@router.patch("/{ticket_id}", response_model=TicketDetailResponse)
async def update_ticket(
    ticket_id: UUID,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.comments).selectinload(Comment.author),
            selectinload(Ticket.created_by),
        )
    )
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden.")
    if current_user.role == UserRole.KUNDE:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")

    update_data = data.model_dump(exclude_unset=True)

    for field, new_value in update_data.items():
        old_value = getattr(ticket, field)

        if field == "status" and old_value != new_value:
            await create_system_note(
                db, ticket.id, current_user.id,
                f"Status geändert: {STATUS_LABELS.get(old_value, old_value)} → "
                f"{STATUS_LABELS.get(new_value, new_value)}"
            )
        elif field == "priority" and old_value != new_value:
            await create_system_note(
                db, ticket.id, current_user.id,
                f"Priorität geändert: {PRIORITY_LABELS.get(old_value, old_value)} → "
                f"{PRIORITY_LABELS.get(new_value, new_value)}"
            )
        elif field == "assigned_agent_id" and old_value != new_value:
            if new_value:
                from app.models.user import User as UserModel, user_group_association
                import uuid as _uuid
                agent_result = await db.execute(
                    select(UserModel).where(UserModel.id == _uuid.UUID(str(new_value)))
                )
                agent = agent_result.scalar_one_or_none()
                agent_name = agent.display_name if agent else str(new_value)

                # Validierung: Agent muss Mitglied der Ticket-Gruppe sein
                if ticket.assigned_group_id and agent and current_user.role == UserRole.AGENT:
                    group_check = await db.execute(
                        select(user_group_association.c.group_id).where(
                            user_group_association.c.user_id == _uuid.UUID(str(new_value)),
                            user_group_association.c.group_id == ticket.assigned_group_id,
                        )
                    )
                    if not group_check.scalar_one_or_none():
                        raise HTTPException(
                            status_code=403,
                            detail=f"Agent '{agent_name}' ist kein Mitglied der zugewiesenen Gruppe."
                        )

                await create_system_note(
                    db, ticket.id, current_user.id,
                    f"Ticket zugewiesen an Agent {agent_name}"
                )
            else:
                await create_system_note(
                    db, ticket.id, current_user.id,
                    "Zuweisung aufgehoben"
                )

        setattr(ticket, field, new_value)

    await db.commit()

    # ES-Index aktualisieren
    try:
        await index_ticket(get_es_client(), ticket)
    except Exception:
        pass

    # WebSocket broadcast
    await broadcast_ticket_update(str(ticket_id), ticket.ticket_number, "updated", {"priority": ticket.priority, "assigned_agent_id": str(ticket.assigned_agent_id) if ticket.assigned_agent_id else None, "status": str(update_data.get("status", ticket.status))})
    await broadcast_stats_update()

    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()

    return ticket
