import secrets
import string
import bcrypt


def hash_password(plain_password: str) -> str:
    """Passwort mit bcrypt hashen."""
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Eingegebenes Passwort gegen Hash prüfen."""
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def generate_onboarding_password(length: int = 10) -> str:
    """
    Zufälliges Einmalpasswort generieren.
    - 10 Zeichen
    - Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl, 1 Sonderzeichen
    """
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special = "!@#$%^&*()-_=+"

    password_chars = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    all_chars = lowercase + uppercase + digits + special
    password_chars += [secrets.choice(all_chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password_chars)

    return "".join(password_chars)


def validate_password_policy(password: str) -> tuple[bool, str]:
    """
    Passwortrichtlinie server-seitig prüfen.
    Gibt (True, "") bei Erfolg, (False, Fehlermeldung) bei Fehler zurück.
    """
    if len(password) < 10:
        return False, "Passwort muss mindestens 10 Zeichen lang sein."
    if not any(c.isupper() for c in password):
        return False, "Passwort muss mindestens einen Großbuchstaben enthalten."
    if not any(c.islower() for c in password):
        return False, "Passwort muss mindestens einen Kleinbuchstaben enthalten."
    if not any(c.isdigit() for c in password):
        return False, "Passwort muss mindestens eine Zahl enthalten."
    if not any(c in "!@#$%^&*()-_=+" for c in password):
        return False, "Passwort muss mindestens ein Sonderzeichen enthalten (!@#$%^&*()-_=+)."
    return True, ""
