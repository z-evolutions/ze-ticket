#!/bin/bash
# ============================================================
# ZE-Ticket — Installations-Script
# ============================================================
# Unterstützt: Debian/Ubuntu
# Voraussetzungen: Root oder sudo-Rechte
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

hr()       { echo -e "${CYAN}════════════════════════════════════════════════════${NC}"; }
hr_thin()  { echo -e "${CYAN}────────────────────────────────────────────────────${NC}"; }
log_ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
log_err()  { echo -e "${RED}  ✗ FEHLER:${NC} $1"; }
log_warn() { echo -e "${YELLOW}  ⚠${NC}  $1"; }
log_info() { echo -e "${CYAN}  →${NC} $1"; }
ask()      { echo -e "${BOLD}$1${NC}"; }

generate_password() {
    python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits + '!@#%^&*') for _ in range(24)))"
}

generate_secret_key() {
    python3 -c "import secrets; print(secrets.token_hex(64))"
}

hr
echo -e "${CYAN}${BOLD}"
echo "  ███████╗███████╗      ████████╗██╗ ██████╗██╗  ██╗███████╗████████╗"
echo "  ╚══███╔╝██╔════╝         ██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝"
echo "    ███╔╝ █████╗           ██║   ██║██║     █████╔╝ █████╗     ██║   "
echo "   ███╔╝  ██╔══╝           ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   "
echo "  ███████╗███████╗         ██║   ██║╚██████╗██║  ██╗███████╗   ██║   "
echo "  ╚══════╝╚══════╝         ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝  "
echo -e "${NC}"
echo -e "  ${BOLD}Self-hosted Ticketsystem by Z-Evolutions${NC}"
echo -e "  Version 1.0 — Installations-Script"
hr
echo ""

# ── Root-Check ──
if [[ $EUID -ne 0 ]]; then
    log_err "Dieses Script muss als root ausgeführt werden."
    echo "   Versuche: sudo ./install.sh"
    exit 1
fi

# ── Betriebssystem prüfen ──
if [[ ! -f /etc/debian_version ]] && [[ ! -f /etc/ubuntu_release ]]; then
    log_warn "Dieses Script wurde für Debian/Ubuntu entwickelt."
    read -p "Trotzdem fortfahren? (ja/nein): " osconfirm
    [[ "$osconfirm" != "ja" ]] && exit 0
fi

echo -e "${BOLD}Schritt 1 — Voraussetzungen prüfen${NC}"
hr_thin

# ── Docker ──
if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_ok "Docker ${DOCKER_VERSION} gefunden"
else
    log_warn "Docker ist nicht installiert."
    read -p "  Docker jetzt installieren? (ja/nein): " install_docker
    if [[ "$install_docker" == "ja" ]]; then
        log_info "Installiere Docker..."
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        systemctl enable docker --now
        log_ok "Docker installiert"
    else
        log_err "Docker wird benötigt. Abbruch."
        exit 1
    fi
fi

# ── Docker Compose ──
if docker compose version &>/dev/null; then
    log_ok "Docker Compose gefunden"
else
    log_warn "Docker Compose nicht gefunden."
    read -p "  Docker Compose Plugin installieren? (ja/nein): " install_compose
    if [[ "$install_compose" == "ja" ]]; then
        apt-get install -y -qq docker-compose-plugin
        log_ok "Docker Compose installiert"
    else
        log_err "Docker Compose wird benötigt. Abbruch."
        exit 1
    fi
fi

# ── Git ──
if command -v git &>/dev/null; then
    log_ok "Git $(git --version | grep -oP '\d+\.\d+\.\d+') gefunden"
else
    log_warn "Git ist nicht installiert."
    read -p "  Git jetzt installieren? (ja/nein): " install_git
    if [[ "$install_git" == "ja" ]]; then
        apt-get install -y -qq git
        log_ok "Git installiert"
    else
        log_err "Git wird benötigt. Abbruch."
        exit 1
    fi
fi

# ── Python3 ──
if command -v python3 &>/dev/null; then
    log_ok "Python3 gefunden"
else
    apt-get install -y -qq python3
    log_ok "Python3 installiert"
fi

# ── Node.js + npm ──
if command -v node &>/dev/null && command -v npm &>/dev/null; then
    log_ok "Node.js $(node --version) + npm gefunden"
else
    log_warn "Node.js/npm nicht gefunden — installiere..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y -qq nodejs
    log_ok "Node.js $(node --version) + npm $(npm --version) installiert"
fi

echo ""
echo -e "${BOLD}Schritt 2 — Installationsverzeichnis${NC}"
hr_thin

read -p "  Installationspfad [/opt/ze-ticket]: " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/opt/ze-ticket}"
log_info "Installiere nach: ${INSTALL_DIR}"

if [[ -d "$INSTALL_DIR" ]]; then
    log_warn "Verzeichnis existiert bereits: ${INSTALL_DIR}"
    read -p "  Überschreiben? (ja/nein): " overwrite
    [[ "$overwrite" != "ja" ]] && { log_err "Abbruch."; exit 1; }
fi

echo ""
echo -e "${BOLD}Schritt 3 — Repository klonen${NC}"
hr_thin

REPO_URL="https://github.com/z-evolutions/ze-ticket.git"
read -p "  Repository-URL [${REPO_URL}]: " custom_repo
REPO_URL="${custom_repo:-$REPO_URL}"

log_info "Klone Repository..."
git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || {
    log_err "Repository konnte nicht geklont werden."
    log_info "Bitte prüfe die URL und deine Internetverbindung."
    exit 1
}
log_ok "Repository geklont"

echo ""
echo -e "${BOLD}Schritt 4 — Konfiguration${NC}"
hr_thin
echo -e "  ${YELLOW}Bitte alle Werte sorgfältig ausfüllen.${NC}"
echo -e "  ${YELLOW}Passwörter können später im Admin-Panel geändert werden.${NC}"
echo ""

# ── App ──
echo -e "  ${BOLD}→ Anwendung${NC}"
read -p "    App-Name [ZE-Ticket]: " APP_NAME
APP_NAME="${APP_NAME:-ZE-Ticket}"

read -p "    App-URL (z.B. https://support.ihre-domain.de): " APP_URL
while [[ -z "$APP_URL" ]]; do
    log_warn "App-URL ist erforderlich."
    read -p "    App-URL: " APP_URL
done

read -p "    Zeitzone [Europe/Berlin]: " TIMEZONE
TIMEZONE="${TIMEZONE:-Europe/Berlin}"

echo ""

# ── Datenbank ──
echo -e "  ${BOLD}→ Datenbank${NC}"
read -p "    PostgreSQL Datenbankname [ze_ticket]: " POSTGRES_DB
POSTGRES_DB="${POSTGRES_DB:-ze_ticket}"

read -p "    PostgreSQL Benutzername [ze_ticket_user]: " POSTGRES_USER
POSTGRES_USER="${POSTGRES_USER:-ze_ticket_user}"

read -p "    PostgreSQL Passwort [automatisch generieren]: " POSTGRES_PASSWORD
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_password)}"
log_info "PostgreSQL Passwort: ${POSTGRES_PASSWORD}"

echo ""

# ── Redis ──
echo -e "  ${BOLD}→ Redis${NC}"
read -p "    Redis Passwort [automatisch generieren]: " REDIS_PASSWORD
REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_password)}"
log_info "Redis Passwort: ${REDIS_PASSWORD}"

echo ""

# ── Elasticsearch ──
echo -e "  ${BOLD}→ Elasticsearch${NC}"
read -p "    Elasticsearch Passwort [automatisch generieren]: " ELASTIC_PASSWORD
ELASTIC_PASSWORD="${ELASTIC_PASSWORD:-$(generate_password)}"
log_info "Elasticsearch Passwort: ${ELASTIC_PASSWORD}"

echo ""

# ── Mail ──
echo -e "  ${BOLD}→ E-Mail (SMTP/IMAP)${NC}"
echo -e "  ${YELLOW}  Hinweis: Mail-Passwörter können später auch im Admin-Panel geändert werden.${NC}"
echo ""

read -p "    SMTP-Host: " SMTP_HOST
read -p "    SMTP-Port [465]: " SMTP_PORT
SMTP_PORT="${SMTP_PORT:-465}"
read -p "    SMTP-Benutzer: " SMTP_USER
read -p "    SMTP-Passwort: " SMTP_PASSWORD
read -p "    Absender-Adresse: " SMTP_FROM
read -p "    Absender-Name [${APP_NAME} Support]: " SMTP_FROM_NAME
SMTP_FROM_NAME="${SMTP_FROM_NAME:-${APP_NAME} Support}"
read -p "    SSL verwenden? (true/false) [true]: " SMTP_SSL
SMTP_SSL="${SMTP_SSL:-true}"

echo ""
read -p "    IMAP-Host [${SMTP_HOST}]: " IMAP_HOST
IMAP_HOST="${IMAP_HOST:-$SMTP_HOST}"
read -p "    IMAP-Port [993]: " IMAP_PORT
IMAP_PORT="${IMAP_PORT:-993}"
read -p "    IMAP-Benutzer [${SMTP_USER}]: " IMAP_USER
IMAP_USER="${IMAP_USER:-$SMTP_USER}"
read -p "    IMAP-Passwort [wie SMTP]: " IMAP_PASSWORD
IMAP_PASSWORD="${IMAP_PASSWORD:-$SMTP_PASSWORD}"

echo ""

# ── Secret Key ──
SECRET_KEY=$(generate_secret_key)
log_info "SECRET_KEY automatisch generiert"

echo ""
echo -e "${BOLD}Schritt 5 — .env Datei erstellen${NC}"
hr_thin

cat > "${INSTALL_DIR}/.env" << ENV
# === PostgreSQL ===
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# === PostgreSQL URL ===
DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@ze_ticket_db:5432/${POSTGRES_DB}
# === Redis ===
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@ze_ticket_redis:6379

# === FastAPI ===
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# === App ===
APP_ENV=production
APP_URL=${APP_URL}
APP_NAME=${APP_NAME}

# === Mail (SMTP) ===
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM=${SMTP_FROM}
SMTP_FROM_NAME=${SMTP_FROM_NAME}
SMTP_SSL=${SMTP_SSL}

# === IMAP (eingehende Mail) ===
IMAP_HOST=${IMAP_HOST}
IMAP_PORT=${IMAP_PORT}
IMAP_USER=${IMAP_USER}
IMAP_PASSWORD=${IMAP_PASSWORD}

# === Elasticsearch ===
ELASTIC_PASSWORD=${ELASTIC_PASSWORD}

# === Zeitzone ===
TIMEZONE=${TIMEZONE}
ENV

chmod 600 "${INSTALL_DIR}/.env"
log_ok ".env erstellt (Berechtigungen: 600)"

echo ""
echo -e "${BOLD}Schritt 6 — Frontend bauen${NC}"
hr_thin

log_info "Installiere Frontend-Abhängigkeiten..."
cd "${INSTALL_DIR}/frontend"
npm install --silent
log_info "Baue Frontend..."
npm run build --silent
log_ok "Frontend gebaut"

# Frontend ins www-Verzeichnis deployen
read -p "  Pfad zum Web-Root (z.B. /home/users/sascha/www/support.ihre-domain.de): " WWW_DIR
if [[ -n "$WWW_DIR" ]]; then
    mkdir -p "$WWW_DIR"
    cp -r "${INSTALL_DIR}/frontend/dist/." "$WWW_DIR/"
    log_ok "Frontend nach ${WWW_DIR} deployed"
else
    log_warn "Kein Web-Root angegeben — Frontend liegt unter: ${INSTALL_DIR}/frontend/dist/"
fi

echo ""
echo -e "${BOLD}Schritt 7 — Docker-Images bauen${NC}"
hr_thin

cd "$INSTALL_DIR"
log_info "Baue Docker-Images (das kann einige Minuten dauern)..."
docker compose -f docker-compose.prod.yml build 2>&1 | grep -E "Step|Successfully|ERROR" || true
log_ok "Images gebaut"

echo ""
echo -e "${BOLD}Schritt 8 — Container starten${NC}"
hr_thin

log_info "Starte Container..."
docker compose -f docker-compose.prod.yml up -d
log_ok "Container gestartet"

echo ""
echo -e "${BOLD}Schritt 9 — Warte auf Backend...${NC}"
hr_thin

log_info "Prüfe ob das Backend bereit ist..."
TRIES=0
MAX_TRIES=30
until curl -sf http://127.0.0.1:8000/api/health | grep -q '"status":"ok"' 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge $MAX_TRIES ]]; then
        log_warn "Backend antwortet noch nicht — bitte manuell prüfen:"
        echo "    docker logs ze_ticket_backend"
        break
    fi
    echo -n "."
    sleep 3
done
echo ""
log_ok "Backend ist bereit"

echo ""
hr
echo -e "${GREEN}${BOLD}  ✅ ZE-Ticket wurde erfolgreich installiert!${NC}"
hr
echo ""
echo -e "  ${BOLD}Nächste Schritte:${NC}"
echo ""
echo -e "  1. ${CYAN}Browser öffnen:${NC} ${APP_URL}"
echo -e "  2. ${CYAN}Setup-Wizard:${NC} Superadmin-Account anlegen"
echo -e "  3. ${CYAN}Admin-Panel → E-Mail:${NC} Konfiguration prüfen & testen"
echo -e "  4. ${CYAN}Admin-Panel → System:${NC} Impressum & Datenschutz ausfüllen"
echo -e "  5. ${CYAN}Admin-Panel → Backup:${NC} Automatisches Backup aktivieren"
echo -e "  6. ${CYAN}Admin-Panel → Benutzer:${NC} Ersten Agenten anlegen"
echo ""
echo -e "  ${YELLOW}⚠  WICHTIG: Bewahre die .env-Datei sicher auf!${NC}"
echo -e "  ${YELLOW}   Pfad: ${INSTALL_DIR}/.env${NC}"
echo -e "  ${YELLOW}   Diese Datei ist nicht im Backup enthalten.${NC}"
echo -e "  ${YELLOW}   Empfehlung: In Passwortmanager speichern.${NC}"
echo ""
echo -e "  ${BOLD}Webserver einrichten:${NC}"
echo -e "  Konfigurationsbeispiele fuer Apache und Nginx:"
echo -e "  ${CYAN}${INSTALL_DIR}/docs/reverse-proxy/${NC}"
echo ""
echo -e "  ${BOLD}Support & Dokumentation:${NC}"
echo -e "  https://github.com/z-evolutions/ze-ticket"
echo ""
hr
