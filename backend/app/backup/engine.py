"""
ZE-Ticket Backup Engine
Unterstützt: Lokal, WebDAV, SFTP, S3-kompatibel
Konfiguration wird aus system_config gelesen.
"""
import asyncio
import gzip
import io
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


# ─── Backup-Konfiguration aus DB lesen ────────────────────────────────────────

async def get_backup_config() -> dict:
    """Liest Backup-Konfiguration aus der DB."""
    from app.core.database import AsyncSessionLocal
    from app.api.config import get_config_value
    from app.core.crypto import decrypt, is_encrypted

    async with AsyncSessionLocal() as db:
        cfg = {}
        keys = [
            "backup_enabled", "backup_target", "backup_schedule_hour",
            "backup_retention_days", "backup_retention_min",
            "backup_include_uploads", "backup_compress",
            # Lokal
            "backup_local_path",
            # WebDAV
            "backup_webdav_url", "backup_webdav_user", "backup_webdav_password", "backup_webdav_path",
            # SFTP
            "backup_sftp_host", "backup_sftp_port", "backup_sftp_user",
            "backup_sftp_password", "backup_sftp_path",
            # S3
            "backup_s3_endpoint", "backup_s3_bucket", "backup_s3_region",
            "backup_s3_access_key", "backup_s3_secret_key", "backup_s3_path",
        ]
        for key in keys:
            cfg[key] = await get_config_value(db, key)
    return cfg


# ─── Datenbank-Dump erstellen ─────────────────────────────────────────────────

async def create_db_dump() -> bytes:
    """PostgreSQL-Dump als Bytes."""
    from app.core.config import settings
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "")
    userpass, hostdb = url.split("@")
    user, password = userpass.split(":")
    hostport, db = hostdb.split("/")
    host, port = hostport.split(":")

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    proc = await asyncio.create_subprocess_exec(
        "pg_dump", "-h", host, "-p", port, "-U", user, db,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"pg_dump fehlgeschlagen: {stderr.decode()}")
    return stdout


# ─── Backup-Archiv erstellen ──────────────────────────────────────────────────

async def create_backup_archive(cfg: dict) -> tuple[bytes, str]:
    """
    Erstellt ein tar.gz-Archiv mit DB-Dump + optional Uploads.
    Gibt (bytes, filename) zurück.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename = f"ze-ticket-backup_{timestamp}.tar.gz"

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        # DB-Dump
        logger.info("[BACKUP] Erstelle PostgreSQL-Dump...")
        db_bytes = await create_db_dump()
        db_info = tarfile.TarInfo(name="database.sql")
        db_info.size = len(db_bytes)
        tar.addfile(db_info, io.BytesIO(db_bytes))
        logger.info(f"[BACKUP] DB-Dump: {len(db_bytes) // 1024} KB")

        # Uploads
        if cfg.get("backup_include_uploads", "true") == "true":
            uploads_dir = Path("/app/uploads")
            if uploads_dir.exists():
                logger.info("[BACKUP] Füge Uploads hinzu...")
                tar.add(str(uploads_dir), arcname="uploads")

    return buf.getvalue(), filename


# ─── Upload-Strategien ────────────────────────────────────────────────────────

async def upload_local(data: bytes, filename: str, cfg: dict) -> str:
    """Lokal speichern."""
    path = Path(cfg.get("backup_local_path") or "/app/backups")
    path.mkdir(parents=True, exist_ok=True)
    target = path / filename
    target.write_bytes(data)
    logger.info(f"[BACKUP] Lokal gespeichert: {target}")
    return str(target)


async def upload_webdav(data: bytes, filename: str, cfg: dict) -> str:
    """WebDAV-Upload (Nextcloud, ownCloud, HiDrive)."""
    from webdav3.client import Client
    from app.core.crypto import decrypt, is_encrypted

    password = cfg.get("backup_webdav_password", "")
    if is_encrypted(password):
        password = decrypt(password)

    options = {
        "webdav_hostname": cfg["backup_webdav_url"],
        "webdav_login":    cfg["backup_webdav_user"],
        "webdav_password": password,
        "webdav_timeout":  30,
    }
    client = Client(options)

    remote_path = (cfg.get("backup_webdav_path") or "/backups").rstrip("/")
    try:
        client.mkdir(remote_path)
    except Exception:
        pass

    remote_file = f"{remote_path}/{filename}"

    # WebDAV-Client erwartet eine Datei → temporär schreiben
    with tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz") as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: client.upload_sync(remote_path=remote_file, local_path=tmp_path)
        )
    finally:
        os.unlink(tmp_path)

    logger.info(f"[BACKUP] WebDAV-Upload: {remote_file}")
    return remote_file


async def upload_sftp(data: bytes, filename: str, cfg: dict) -> str:
    """SFTP-Upload."""
    import asyncssh
    from app.core.crypto import decrypt, is_encrypted

    password = cfg.get("backup_sftp_password", "")
    if is_encrypted(password):
        password = decrypt(password)

    host = cfg["backup_sftp_host"]
    port = int(cfg.get("backup_sftp_port") or "22")
    user = cfg["backup_sftp_user"]
    remote_dir = (cfg.get("backup_sftp_path") or "/backups").rstrip("/")
    remote_file = f"{remote_dir}/{filename}"

    async with asyncssh.connect(
        host, port=port, username=user, password=password,
        known_hosts=None,
    ) as conn:
        async with conn.start_sftp_client() as sftp:
            try:
                await sftp.mkdir(remote_dir)
            except Exception:
                pass
            async with sftp.open(remote_file, "wb") as f:
                await f.write(data)

    logger.info(f"[BACKUP] SFTP-Upload: {remote_file}")
    return remote_file


async def upload_s3(data: bytes, filename: str, cfg: dict) -> str:
    """S3-kompatibler Upload (Hetzner, Backblaze, AWS)."""
    import boto3
    from botocore.config import Config
    from app.core.crypto import decrypt, is_encrypted

    secret_key = cfg.get("backup_s3_secret_key", "")
    if is_encrypted(secret_key):
        secret_key = decrypt(secret_key)

    s3_path = (cfg.get("backup_s3_path") or "").strip("/")
    key = f"{s3_path}/{filename}" if s3_path else filename

    kwargs = dict(
        aws_access_key_id=cfg["backup_s3_access_key"],
        aws_secret_access_key=secret_key,
        region_name=cfg.get("backup_s3_region") or "auto",
    )
    if cfg.get("backup_s3_endpoint"):
        kwargs["endpoint_url"] = cfg["backup_s3_endpoint"]

    s3 = boto3.client("s3", **kwargs)
    await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: s3.put_object(
            Bucket=cfg["backup_s3_bucket"],
            Key=key,
            Body=data,
            ContentType="application/gzip",
        )
    )
    logger.info(f"[BACKUP] S3-Upload: s3://{cfg['backup_s3_bucket']}/{key}")
    return f"s3://{cfg['backup_s3_bucket']}/{key}"


# ─── Alte Backups bereinigen ──────────────────────────────────────────────────

async def cleanup_old_backups(cfg: dict) -> int:
    """Alte lokale Backups löschen (nur für lokales Ziel)."""
    if cfg.get("backup_target") != "local":
        return 0

    from datetime import timedelta
    retention_days = int(cfg.get("backup_retention_days") or "30")
    retention_min  = int(cfg.get("backup_retention_min") or "7")
    path = Path(cfg.get("backup_local_path") or "/app/backups")

    if not path.exists():
        return 0

    backups = sorted(path.glob("ze-ticket-backup_*.tar.gz"), key=lambda f: f.stat().st_mtime, reverse=True)
    deleted = 0
    cutoff = datetime.now(timezone.utc).timestamp() - (retention_days * 86400)

    for i, f in enumerate(backups):
        if i < retention_min:
            continue
        if f.stat().st_mtime < cutoff:
            f.unlink()
            deleted += 1
            logger.info(f"[BACKUP] Gelöscht (alt): {f.name}")

    return deleted


# ─── Haupt-Backup-Funktion ────────────────────────────────────────────────────

async def run_backup() -> dict:
    """Führt ein vollständiges Backup durch. Gibt Status-Dict zurück."""
    start = datetime.now(timezone.utc)
    cfg = await get_backup_config()

    if cfg.get("backup_enabled") != "true":
        return {"status": "skipped", "reason": "Backup deaktiviert"}

    target = cfg.get("backup_target", "local")
    logger.info(f"[BACKUP] Starte Backup → Ziel: {target}")

    try:
        data, filename = await create_backup_archive(cfg)
        size_mb = round(len(data) / (1024 * 1024), 2)

        if target == "local":
            location = await upload_local(data, filename, cfg)
        elif target == "webdav":
            location = await upload_webdav(data, filename, cfg)
        elif target == "sftp":
            location = await upload_sftp(data, filename, cfg)
        elif target == "s3":
            location = await upload_s3(data, filename, cfg)
        else:
            raise ValueError(f"Unbekanntes Backup-Ziel: {target}")

        deleted = await cleanup_old_backups(cfg)
        duration = round((datetime.now(timezone.utc) - start).total_seconds(), 1)

        logger.info(f"[BACKUP] ✅ Erfolgreich — {filename} ({size_mb} MB) in {duration}s")
        return {
            "status":   "ok",
            "filename": filename,
            "size_mb":  size_mb,
            "location": location,
            "deleted":  deleted,
            "duration": duration,
        }

    except Exception as e:
        logger.error(f"[BACKUP] ❌ Fehler: {e}")
        return {"status": "error", "error": str(e)}


# ─── Background-Task (Scheduler) ─────────────────────────────────────────────

async def start_backup_scheduler() -> None:
    """Läuft als asyncio Background-Task — prüft stündlich ob Backup fällig."""
    logger.info("[BACKUP] Scheduler gestartet")
    while True:
        try:
            cfg = await get_backup_config()
            if cfg.get("backup_enabled") == "true":
                scheduled_hour = int(cfg.get("backup_schedule_hour") or "2")
                now = datetime.now(timezone.utc)
                if now.hour == scheduled_hour and now.minute < 5:
                    logger.info(f"[BACKUP] Geplantes Backup um {scheduled_hour}:00 Uhr")
                    await run_backup()
        except Exception as e:
            logger.error(f"[BACKUP] Scheduler-Fehler: {e}")
        await asyncio.sleep(300)  # alle 5 Minuten prüfen
