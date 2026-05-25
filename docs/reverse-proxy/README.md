# ZE-Ticket — Webserver-Konfiguration

ZE-Ticket läuft als Docker-Anwendung und benötigt einen Reverse-Proxy der:

- HTTPS terminiert
- Anfragen an `/api/` und `/uploads/` an das Backend (Port 8000) weiterleitet
- WebSocket-Verbindungen unter `/ws/` durchleitet
- Das React-Frontend (statische Dateien im `dist/`-Verzeichnis) ausliefert

## Welche Anleitung ist die richtige?

| Setup | Anleitung |
|---|---|
| Apache + Keyhelp ACP | [apache-keyhelp.md](apache-keyhelp.md) |
| Apache standalone (ohne Panel) | [apache.md](apache.md) |
| Nginx (standalone) | [nginx.md](nginx.md) |
| Cloudflare (Origin CA, SSL-Modus) | [cloudflare.md](cloudflare.md) |

## Grundprinzip
Internet → Cloudflare/SSL → Apache/Nginx (Reverse Proxy) → Docker (Port 8000)
↓
React Frontend (dist/)
## Ports

| Dienst | Port | Erreichbar von |
|---|---|---|
| FastAPI Backend | 127.0.0.1:8000 | Nur lokal (nie direkt öffentlich!) |
| Apache/Nginx | 80, 443 | Öffentlich |

> ⚠️ Port 8000 darf **niemals** direkt öffentlich erreichbar sein.
> Der Reverse-Proxy ist der einzige Zugang von außen.

## Benötigte Apache-Module

```bash
a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
systemctl restart apache2
```

## Benötigte Nginx-Module

Nginx bringt alle benötigten Module in der Standardinstallation mit.
