import asyncio
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.tickets import router as tickets_router
from app.api.comments import router as comments_router
from app.api.users import router as users_router
from app.api.email_webhook import router as email_router
from app.api.maintenance import router as maintenance_router
from app.api.groups import router as groups_router
from app.websocket.router import router as ws_router
from app.api.portal import router as portal_router
from app.api.presence import router as presence_router
from app.api.setup import router as setup_router
from app.api.customer_auth import router as customer_auth_router
from app.api.admin import router as admin_router
from app.api.config import router as config_router
from app.api.attachments import router as attachments_router
from app.mail.poller import start_poller
from app.core.sla_service import check_sla_breaches, cleanup_audit_log
from app.search.client import get_es_client, close_es_client
from app.search.tickets import ensure_index
from app.api.config import set_config_value, get_config_value
from app.core.database import AsyncSessionLocal

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 {settings.APP_NAME} startet im {settings.APP_ENV}-Modus")

    # ── Mail-Config Migration: .env → DB (einmalig beim ersten Start) ──────────
    try:
        async with AsyncSessionLocal() as db:
            mapping = {
                "mail_smtp_host":      settings.SMTP_HOST,
                "mail_smtp_port":      str(settings.SMTP_PORT),
                "mail_smtp_user":      settings.SMTP_USER,
                "mail_smtp_password":  settings.SMTP_PASSWORD,
                "mail_smtp_from":      settings.SMTP_FROM,
                "mail_smtp_from_name": settings.SMTP_FROM_NAME,
                "mail_smtp_ssl":       "true" if settings.SMTP_SSL else "false",
                "mail_imap_host":      settings.IMAP_HOST,
                "mail_imap_port":      str(settings.IMAP_PORT),
                "mail_imap_user":      settings.IMAP_USER,
                "mail_imap_password":  settings.IMAP_PASSWORD,
                "mail_imap_ssl":       "true",
                "mail_imap_enabled":   "false",
            }
            migrated = 0
            for key, env_value in mapping.items():
                existing = await get_config_value(db, key)
                if not existing and env_value:
                    await set_config_value(db, key, env_value)
                    migrated += 1
            if migrated > 0:
                await db.commit()
                print(f"📧 Mail-Config migriert: {migrated} Werte aus .env übernommen", flush=True)
            else:
                print("📧 Mail-Config bereits in DB vorhanden", flush=True)
    except Exception as e:
        print(f"⚠️  Mail-Config Migration fehlgeschlagen: {e}")

    # Elasticsearch-Index sicherstellen
    try:
        es = get_es_client()
        await ensure_index(es)
        print("🔍 Elasticsearch-Index bereit")
    except Exception as e:
        print(f"⚠️  Elasticsearch nicht erreichbar: {e}")

    # IMAP-Poller als Background-Task starten
    poller_task = asyncio.create_task(start_poller())
    print("📬 IMAP-Poller gestartet")
    sla_task = asyncio.create_task(check_sla_breaches())
    print("⏱️  SLA-Monitor gestartet")
    from app.backup.engine import start_backup_scheduler
    backup_task = asyncio.create_task(start_backup_scheduler())
    print("🗄️  Backup-Scheduler gestartet", flush=True)
    audit_cleanup_task = asyncio.create_task(cleanup_audit_log())
    print("🧹 Audit-Log Cleanup gestartet (90 Tage Aufbewahrung)")

    yield

    # Sauber beenden
    poller_task.cancel()
    sla_task.cancel()
    audit_cleanup_task.cancel()
    backup_task.cancel()
    try:
        await poller_task
        await sla_task
        await audit_cleanup_task
        await backup_task
    except asyncio.CancelledError:
        pass

    await close_es_client()
    print(f"🛑 {settings.APP_NAME} wird gestoppt")


app = FastAPI(
    title=settings.APP_NAME,
    description="Self-hosted Ticketsystem by Z-Evolutions",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/api/redoc" if settings.APP_ENV == "development" else None,
)

# Proxy-Headers vertrauen (Apache + Cloudflare)
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.APP_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# ─── Router ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(tickets_router)
app.include_router(comments_router)
app.include_router(users_router)
app.include_router(email_router)
app.include_router(maintenance_router)
app.include_router(groups_router)
app.include_router(ws_router)
app.include_router(portal_router)
app.include_router(presence_router)
app.include_router(setup_router)
app.include_router(customer_auth_router)
app.include_router(admin_router)
app.include_router(config_router)
app.include_router(attachments_router)

# ─── Static Files (Uploads) ───────────────────────────────────────────────────
import os
try:
    os.makedirs("/app/uploads/avatars", exist_ok=True)
except PermissionError:
    pass  # In CI/Test-Umgebungen ohne Schreibrechte
# Uploads-Verzeichnis nur mounten wenn es existiert (nicht in CI)
import os as _os
if _os.path.exists("/app/uploads"):
    app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# ─── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check():
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    import redis.asyncio as aioredis
    import time

    start = time.time()
    checks = {}
    overall = "ok"

    # PostgreSQL
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        overall = "degraded"

    # Redis
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
        overall = "degraded"

    # Elasticsearch
    try:
        es = get_es_client()
        info = await es.cluster.health()
        es_status = info.get("status", "unknown")
        checks["elasticsearch"] = es_status if es_status in ("green", "yellow") else f"error: {es_status}"
        if es_status == "red":
            overall = "degraded"
    except Exception as e:
        checks["elasticsearch"] = f"error: {e}"
        overall = "degraded"

    return {
        "status": overall,
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "checks": checks,
        "response_ms": round((time.time() - start) * 1000, 1),
    }
