"""
Mail-Konfiguration aus DB lesen.
Zentraler Zugriffspunkt für SMTP + IMAP Einstellungen.
Passwörter werden automatisch entschlüsselt.
"""
import logging
from dataclasses import dataclass
from app.core.database import AsyncSessionLocal
from app.api.config import get_config_value

logger = logging.getLogger(__name__)


@dataclass
class SmtpConfig:
    host: str
    port: int
    user: str
    password: str
    from_email: str
    from_name: str
    use_ssl: bool


@dataclass
class ImapConfig:
    host: str
    port: int
    user: str
    password: str
    use_ssl: bool
    enabled: bool


async def get_smtp_config() -> SmtpConfig:
    """Liest SMTP-Konfiguration aus der DB."""
    async with AsyncSessionLocal() as db:
        return SmtpConfig(
            host=await get_config_value(db, "mail_smtp_host"),
            port=int(await get_config_value(db, "mail_smtp_port") or "465"),
            user=await get_config_value(db, "mail_smtp_user"),
            password=await get_config_value(db, "mail_smtp_password"),
            from_email=await get_config_value(db, "mail_smtp_from"),
            from_name=await get_config_value(db, "mail_smtp_from_name"),
            use_ssl=(await get_config_value(db, "mail_smtp_ssl")).lower() == "true",
        )


async def get_imap_config() -> ImapConfig:
    """Liest IMAP-Konfiguration aus der DB."""
    async with AsyncSessionLocal() as db:
        return ImapConfig(
            host=await get_config_value(db, "mail_imap_host"),
            port=int(await get_config_value(db, "mail_imap_port") or "993"),
            user=await get_config_value(db, "mail_imap_user"),
            password=await get_config_value(db, "mail_imap_password"),
            use_ssl=(await get_config_value(db, "mail_imap_ssl")).lower() == "true",
            enabled=(await get_config_value(db, "mail_imap_enabled")).lower() == "true",
        )
