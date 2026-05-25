"""
ZE-Ticket Restore Engine
Stellt Datenbank und/oder Uploads aus einem Backup-Archiv wieder her.
"""
import asyncio
import io
import logging
import os
import shutil
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


async def restore_from_archive(
    archive_data: bytes,
    restore_db: bool = True,
    restore_uploads: bool = True,
) -> dict:
    """
    Stellt Daten aus einem tar.gz-Backup-Archiv wieder her.
    Gibt Status-Dict zurück.
    """
    from app.core.config import settings

    start = datetime.now(timezone.utc)
    results = {}

    # Archiv in temporäres Verzeichnis entpacken
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            buf = io.BytesIO(archive_data)
            with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                tar.extractall(tmpdir)
        except Exception as e:
            return {"status": "error", "error": f"Archiv konnte nicht entpackt werden: {e}"}

        tmppath = Path(tmpdir)

        # ── Datenbank wiederherstellen ──
        if restore_db:
            db_file = tmppath / "database.sql"
            if not db_file.exists():
                results["database"] = "error: database.sql nicht im Archiv gefunden"
            else:
                try:
                    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "")
                    userpass, hostdb = url.split("@")
                    user, password = userpass.split(":")
                    hostport, db = hostdb.split("/")
                    host, port = hostport.split(":")

                    env = os.environ.copy()
                    env["PGPASSWORD"] = password

                    # Bestehende Verbindungen trennen
                    terminate_proc = await asyncio.create_subprocess_exec(
                        "psql", "-h", host, "-p", port, "-U", user, "postgres",
                        "-c", f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='{db}' AND pid <> pg_backend_pid();",
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                        env=env,
                    )
                    await terminate_proc.wait()

                    # DB leeren und neu befüllen
                    restore_proc = await asyncio.create_subprocess_exec(
                        "psql", "-h", host, "-p", port, "-U", user, db,
                        stdin=open(str(db_file), "rb"),
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.PIPE,
                        env=env,
                    )
                    _, stderr = await restore_proc.communicate()

                    if restore_proc.returncode == 0:
                        size_kb = db_file.stat().st_size // 1024
                        results["database"] = f"ok ({size_kb} KB)"
                        logger.info(f"[RESTORE] Datenbank wiederhergestellt ({size_kb} KB)")
                    else:
                        results["database"] = f"error: {stderr.decode()[:200]}"
                        logger.error(f"[RESTORE] DB-Fehler: {stderr.decode()[:200]}")

                except Exception as e:
                    results["database"] = f"error: {e}"
                    logger.error(f"[RESTORE] DB-Exception: {e}")

        # ── Uploads wiederherstellen ──
        if restore_uploads:
            uploads_src = tmppath / "uploads"
            uploads_dst = Path("/app/uploads")

            if not uploads_src.exists():
                results["uploads"] = "nicht im Archiv enthalten — übersprungen"
            else:
                try:
                    # Backup der aktuellen Uploads
                    backup_dst = Path("/app/uploads_backup_before_restore")
                    if uploads_dst.exists():
                        if backup_dst.exists():
                            shutil.rmtree(backup_dst)
                        shutil.copytree(uploads_dst, backup_dst)

                    # Uploads wiederherstellen
                    if uploads_dst.exists():
                        shutil.rmtree(uploads_dst)
                    shutil.copytree(uploads_src, uploads_dst)

                    file_count = sum(1 for _ in uploads_dst.rglob("*") if _.is_file())
                    results["uploads"] = f"ok ({file_count} Dateien)"
                    logger.info(f"[RESTORE] Uploads wiederhergestellt ({file_count} Dateien)")

                except Exception as e:
                    results["uploads"] = f"error: {e}"
                    logger.error(f"[RESTORE] Uploads-Exception: {e}")

    duration = round((datetime.now(timezone.utc) - start).total_seconds(), 1)
    overall = "ok" if all("error" not in str(v) for v in results.values()) else "partial"

    return {
        "status":   overall,
        "results":  results,
        "duration": duration,
    }
