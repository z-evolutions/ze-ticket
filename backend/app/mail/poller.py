"""
IMAP-Poller: Läuft als AsyncIO Background-Task.
Prüft alle 60 Sekunden auf neue Mails.
"""
import asyncio
import logging
from datetime import datetime

from app.mail.imap_client import fetch_unseen_mails
from app.mail.imap_processor import process_mail

logger = logging.getLogger(__name__)

# Globaler Status (für /api/email/status)
poll_status = {
    "running": False,
    "last_poll": None,
    "last_error": None,
    "mails_processed": 0,
    "polls_total": 0,
}

POLL_INTERVAL = 60  # Sekunden


async def poll_once() -> int:
    """Einmaliger Poll-Durchlauf. Gibt Anzahl verarbeiteter Mails zurück."""
    poll_status["polls_total"] += 1
    poll_status["last_poll"] = datetime.now().isoformat()

    try:
        mails = await fetch_unseen_mails()
        for mail in mails:
            await process_mail(mail)
            poll_status["mails_processed"] += 1

        poll_status["last_error"] = None
        if mails:
            logger.info(f"[POLLER] {len(mails)} Mail(s) verarbeitet.")
        return len(mails)

    except Exception as e:
        poll_status["last_error"] = str(e)
        logger.error(f"[POLLER] Fehler: {e}")
        return 0


async def start_poller() -> None:
    """Dauerhafter Polling-Loop — läuft als Background-Task."""
    poll_status["running"] = True
    logger.info(f"[POLLER] Gestartet — Intervall: {POLL_INTERVAL}s")

    while True:
        try:
            await poll_once()
        except Exception as e:
            logger.error(f"[POLLER] Unerwarteter Fehler: {e}")
        await asyncio.sleep(POLL_INTERVAL)
