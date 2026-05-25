# ZE-Ticket

**Self-hosted, DSGVO-konformes Ticketsystem by Z-Evolutions**

Ein vollständig selbst gehostetes Support-Ticketsystem — ohne Abhängigkeiten von großen Tech-Konzernen, vollständig Docker-basiert und datenschutzkonform nach DSGVO.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Python](https://img.shields.io/badge/python-3.12-blue)
![React](https://img.shields.io/badge/react-19-blue)
![Tests](https://img.shields.io/badge/tests-45%20passed-green)

---

## Features

- **Ticket-Management** — Erstellen, zuweisen, kommentieren, kategorisieren
- **Multi-Rollen-System** — Superadmin, Admin, Manager, Agent, Kunde
- **Ticket-Sichtbarkeit** — Konfigurierbar: alle / eigene + unzugewiesene / nur eigene Gruppe
- **Kunden-Portal** — Öffentliches Ticket-Formular + Kunden-Login (3-Faktor)
- **E-Mail-Integration** — SMTP (ausgehend) + IMAP-Polling (eingehend)
- **SLA-Management** — Fristen, Eskalationen, Transparenz-Option
- **Echtzeit-Updates** — WebSocket + Toast-Benachrichtigungen + Glocken in NavBar
- **Volltextsuche** — Elasticsearch-basiert
- **Backup-System** — Lokal, WebDAV, SFTP, S3-kompatibel
- **Admin-Panel** — Vollständige Konfiguration im Browser
- **Betreiber-Variablen** — `{{firma}}`, `{{inhaber}}` etc. in Datenschutz + Impressum
- **Mehrsprachigkeit** — DE/EN, neue Sprachen per JSON-Datei hinzufügbar
- **DSGVO-konform** — Pseudonymisierung, Datenlöschung, Audit-Log
- **Sicherheits-geprüft** — 0 bekannte CVEs (pip-audit + npm audit)
- **Getestet** — 45 automatisierte Tests (Backend + Frontend)
- **Dark/Light Mode** — Cyberpunk-Design (Navy/Cyan, Glassmorphism)

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Backend | Python 3.12 + FastAPI 0.136 |
| Frontend | React 19 + Vite |
| Datenbank | PostgreSQL 16 |
| Cache | Redis 7 |
| Suche | Elasticsearch 8.13 |
| Container | Docker + Docker Compose |
| Auth | JWT + bcrypt |
| Verschlüsselung | Fernet/AES (sensible Config-Werte) |
| i18n | i18next (DE/EN, erweiterbar) |
| Tests | pytest + vitest |

---

## Voraussetzungen

- Debian 12+ oder Ubuntu 22.04+
- Docker 24+ und Docker Compose Plugin
- Git
- Mindestens 2 GB RAM (empfohlen: 4 GB+)
- Domain mit SSL (Cloudflare empfohlen)

---

## Installation

### Vollautomatisch (empfohlen)

```bash
cd /tmp
git clone https://github.com/z-evolutions/ze-ticket.git
cd ze-ticket
chmod +x install.sh
sudo ./install.sh
```

Das Script installiert alle Abhängigkeiten, richtet Docker ein, generiert die `.env` und startet das System.

### Nach der Installation

1. **Browser öffnen** → `https://deine-domain.de`
2. **Setup-Wizard** → Superadmin-Account anlegen
3. **Admin-Panel → E-Mail** → Mailserver konfigurieren und testen
4. **Admin-Panel → System** → Betreiber-Daten + Impressum + Datenschutz ausfüllen
5. **Admin-Panel → Backup** → Automatisches Backup aktivieren
6. **Admin-Panel → Benutzer** → Ersten Agenten anlegen

---

## Webserver einrichten

Beispiel-Konfigurationen für Apache, Nginx und Cloudflare:

```
docs/reverse-proxy/
├── apache.md          # Apache + Let's Encrypt
├── apache-keyhelp.md  # Apache + Keyhelp ACP
├── nginx.md           # Nginx + Let's Encrypt
└── cloudflare.md      # Cloudflare Origin CA
```

---

## Backup & Restore

### Backup konfigurieren

Im Admin-Panel unter **Backup** können folgende Ziele konfiguriert werden:

- **Lokal** — auf dem Server
- **WebDAV** — Nextcloud, ownCloud, HiDrive
- **SFTP** — NAS, eigener Server
- **S3-kompatibel** — Hetzner Object Storage, Backblaze B2, AWS S3

### Automatisches Backup (Admin-Panel)

Der integrierte Backup-Scheduler läuft als Background-Task im Container und erstellt täglich ein Backup zur konfigurierten Uhrzeit. Aktivierung im Admin-Panel unter **Backup**.

### Manuelles Backup per Cronjob (optional)

Zusätzlich kann `backup.sh` als Cronjob eingerichtet werden:

```bash
# Cronjob einrichten — täglich um 03:00 Uhr
crontab -e

# Folgende Zeile hinzufügen:
0 3 * * * /pfad/zu/ze-ticket/backup.sh >> /var/log/ze-ticket-backup.log 2>&1
```

> Das Backup-Script sichert Datenbank + Uploads und speichert sie lokal.
> Für externe Sicherung (WebDAV, SFTP, S3) den Admin-Panel-Scheduler verwenden.

### Manuelles Restore per Script

```bash
# Vollständiges Restore
./restore.sh /pfad/zum/backup.tar.gz

# Nur Datenbank
./restore.sh /pfad/zum/backup.tar.gz --db-only

# Nur Uploads
./restore.sh /pfad/zum/backup.tar.gz --uploads-only
```

> ⚠️ **Wichtig:** Die `.env`-Datei ist **nicht** im Backup enthalten.
> Bewahre sie separat auf (z.B. Passwortmanager). Ohne `.env` kann das System
> nach einem Totalausfall nicht wiederhergestellt werden.

---

## Tests ausführen

```bash
# Alle Tests (Backend + Frontend)
make test

# Nur Backend
make test-backend

# Nur Frontend
make test-frontend
```

**Aktueller Stand:** 45/45 Tests bestanden ✅

---

## Mehrsprachigkeit

Neue Sprache hinzufügen:

1. Neue Datei `frontend/src/i18n/locales/[Sprachkürzel].json` anlegen
2. `meta`-Block einfügen:
```json
{
  "meta": {
    "flag": "fr",
    "label": "Français"
  },
  "common": { ... }
}
```
3. `npm run build` ausführen — die Sprache erscheint automatisch im Dropdown

---

## Projektstruktur

```
ze-ticket/
├── backend/
│   ├── app/
│   │   ├── api/          # REST API Endpunkte
│   │   ├── backup/       # Backup & Restore Engine
│   │   ├── mail/         # SMTP/IMAP Integration
│   │   ├── models/       # SQLAlchemy Modelle
│   │   ├── websocket/    # WebSocket Manager
│   │   └── core/         # Config, Auth, Crypto
│   ├── tests/            # pytest Test-Suite
│   ├── migrations/       # Alembic Migrationen
│   ├── requirements.txt  # Produktions-Abhängigkeiten
│   ├── requirements-dev.txt  # Entwicklungs-Abhängigkeiten
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/        # Seiten-Komponenten
│   │   ├── components/   # Wiederverwendbare Komponenten
│   │   ├── hooks/        # Custom React Hooks
│   │   ├── store/        # Globaler State (Notifications)
│   │   └── i18n/         # Übersetzungen (DE/EN + erweiterbar)
│   └── src/test/         # vitest Test-Suite
├── docs/
│   └── reverse-proxy/    # Webserver-Konfigurationsbeispiele
├── docker-compose.yml        # Entwicklung
├── docker-compose.prod.yml   # Produktion
├── install.sh                # Installations-Script
├── restore.sh                # Restore-Script
├── backup.sh                 # Manuelles Backup-Script
├── Makefile                  # Test-Shortcuts
└── .env.example              # Konfigurationsvorlage
```

---

## Umgebungsvariablen

Alle Variablen sind in `.env.example` dokumentiert. Die wichtigsten:

| Variable | Beschreibung |
|---|---|
| `SECRET_KEY` | JWT-Signierungsschlüssel (automatisch generiert) |
| `APP_URL` | Öffentliche URL des Systems (SSL-kritisch, nur per .env) |
| `POSTGRES_PASSWORD` | Datenbankpasswort |
| `SMTP_HOST` / `SMTP_PORT` | Mailserver-Konfiguration |

> Mail-Passwörter und weitere Konfigurationen können nach der Installation
> auch im Admin-Panel geändert werden — verschlüsselt in der Datenbank gespeichert.

---

## Sicherheit

- JWT-Auth mit kurzem Ablauf + Refresh-Token
- bcrypt Passwort-Hashing + Passwort-Stärke-Anzeige
- Rate Limiting (Redis-basiert)
- Security Headers (CSP, X-Frame-Options, XSS-Protection)
- CORS-Schutz (nur konfigurierte Origins)
- Ticket-Zugriffsschutz nach Gruppen (Backend-seitig validiert)
- Agent-Zuweisung nur für Gruppenmitglieder
- DSGVO Art. 17 — Datenlöschung auf Anfrage
- Audit-Log aller Systemaktionen (90 Tage Aufbewahrung)
- Verschlüsselte Speicherung sensibler Konfigurationswerte (Fernet/AES)
- 0 bekannte CVEs (regelmäßig geprüft mit `pip-audit` + `npm audit`)

---

## API-Dokumentation

Die interaktive API-Dokumentation ist im laufenden System verfügbar:

- **Swagger UI:** `https://deine-domain.de/docs`
- **ReDoc:** `https://deine-domain.de/redoc`

> Die API-Docs sind im Produktionsmodus deaktiviert. Für Entwicklungszwecke
> `APP_ENV=development` in der `.env` setzen.

---

## Entwicklung

```bash
# Repository klonen
git clone https://github.com/z-evolutions/ze-ticket.git
cd ze-ticket

# Umgebung starten
docker compose up -d

# Frontend im Dev-Modus
cd frontend && npm install && npm run dev

# Tests ausführen
make test
```

---

## Mitmachen

Beiträge sind willkommen! Bitte lies zuerst [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Lizenz

AGPL-3.0 — siehe [LICENSE](LICENSE)

---

## Autor

**S. Merken / Z-Evolutions**
[z-evolutions.de](https://z-evolutions.de)