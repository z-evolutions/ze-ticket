"""
Verschlüsselung sensibler Konfigurationswerte (z.B. Mail-Passwörter).
Nutzt Fernet (AES-128-CBC + HMAC) mit dem SECRET_KEY als Basis.
Der SECRET_KEY wird per PBKDF2 auf 32 Bytes normiert — egal wie lang er ist.
"""
import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    """Leitet einen stabilen 32-Byte-Key aus dem SECRET_KEY ab."""
    key_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        settings.SECRET_KEY.encode(),
        b'ze-ticket-salt',
        iterations=100_000,
        dklen=32,
    )
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt(value: str) -> str:
    """Verschlüsselt einen String → gibt verschlüsselten String zurück."""
    if not value:
        return ""
    f = _get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Entschlüsselt einen verschlüsselten String → gibt Klartext zurück."""
    if not value:
        return ""
    f = _get_fernet()
    return f.decrypt(value.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Prüft ob ein Wert bereits verschlüsselt ist (Fernet-Token fangen mit 'gAAAAA' an)."""
    return value.startswith("gAAAAA")
