import aioimaplib
import email
import ssl
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
import logging

from app.mail.config import get_imap_config

logger = logging.getLogger(__name__)


def _decode_header_value(value: str) -> str:
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _extract_body(msg: email.message.Message) -> tuple[str, str]:
    plain = ""
    html = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            if ct == "text/plain" and not plain:
                plain = part.get_payload(decode=True).decode(charset, errors="replace")
            elif ct == "text/html" and not html:
                html = part.get_payload(decode=True).decode(charset, errors="replace")
    else:
        charset = msg.get_content_charset() or "utf-8"
        payload = msg.get_payload(decode=True)
        if payload:
            plain = payload.decode(charset, errors="replace")
    return plain.strip(), html.strip()


class ParsedMail:
    def __init__(self, uid: str, msg: email.message.Message):
        self.uid = uid

        from_raw = msg.get("From", "")
        self.from_name, self.from_email = parseaddr(from_raw)
        self.from_name = _decode_header_value(self.from_name) if self.from_name else self.from_email

        subject_raw = msg.get("Subject", "(Kein Betreff)")
        self.subject = _decode_header_value(subject_raw)

        self.message_id  = msg.get("Message-ID", "").strip()
        self.in_reply_to = msg.get("In-Reply-To", "").strip()
        self.references  = msg.get("References", "").strip()

        date_str = msg.get("Date", "")
        try:
            self.date = parsedate_to_datetime(date_str)
        except Exception:
            from datetime import datetime, timezone
            self.date = datetime.now(timezone.utc)

        self.plain, self.html = _extract_body(msg)
        self.body = self.plain or self.html or "(Leere Nachricht)"

    def __repr__(self):
        return f"<ParsedMail from={self.from_email} subject={self.subject[:40]}>"


async def fetch_unseen_mails() -> list[ParsedMail]:
    mails = []
    cfg = await get_imap_config()

    # IMAP-Schalter prüfen
    if not cfg.enabled:
        logger.info("[IMAP] Polling deaktiviert (Admin-Schalter).")
        return []

    # SSL ohne Hostname-Verifikation — Cloudflare Origin Cert
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    try:
        imap = aioimaplib.IMAP4_SSL(
            host=cfg.host,
            port=cfg.port,
            ssl_context=ssl_ctx,
        )
        await imap.wait_hello_from_server()
        await imap.login(cfg.user, cfg.password)
        await imap.select("INBOX")

        _, data = await imap.search("UNSEEN")
        uid_list = data[0].decode().split() if data[0] else []

        if not uid_list:
            await imap.logout()
            return []

        logger.info(f"[IMAP] {len(uid_list)} ungelesene Mail(s) gefunden.")

        for uid in uid_list:
            try:
                _, msg_data = await imap.fetch(uid, "(RFC822)")
                raw = msg_data[1]
                msg = email.message_from_bytes(raw)
                parsed = ParsedMail(uid=uid, msg=msg)
                mails.append(parsed)
                await imap.store(uid, "+FLAGS", "\\Seen")
            except Exception as e:
                logger.error(f"[IMAP] Fehler bei UID {uid}: {e}")

        await imap.logout()

    except Exception as e:
        logger.error(f"[IMAP] Verbindungsfehler: {e}")

    return mails
