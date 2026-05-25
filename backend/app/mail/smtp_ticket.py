"""
Ticket-bezogene E-Mail-Benachrichtigungen.
Alle Funktionen sind nach service.py migriert — dieser Import bleibt
fuer Rueckwaertskompatibilitaet mit bestehenden Importen.
"""
from app.mail.service import (
    send_ticket_confirmation,
    send_comment_notification,
    send_portal_ticket_confirmation,
    send_sla_breach_mail,
)

__all__ = [
    "send_ticket_confirmation",
    "send_comment_notification",
    "send_portal_ticket_confirmation",
    "send_sla_breach_mail",
]
