import aiosmtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.mail.config import get_smtp_config


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str = "",
) -> None:
    cfg = await get_smtp_config()

    message = MIMEMultipart("alternative")
    message["From"] = f"{cfg.from_name} <{cfg.from_email}>"
    message["To"] = to_email
    message["Subject"] = subject

    if plain_body:
        message.attach(MIMEText(plain_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    # SSL ohne Hostname-Verifikation — Cloudflare Origin Cert
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    await aiosmtplib.send(
        message,
        hostname=cfg.host,
        port=cfg.port,
        username=cfg.user,
        password=cfg.password,
        use_tls=cfg.use_ssl,
        tls_context=ssl_ctx,
    )
