#!/bin/bash
# ============================================================
# ZE-Ticket — Manuelles Restore Script
# ============================================================
# Verwendung:
#   ./restore.sh backup_2026-05-24_02-00.tar.gz
#   ./restore.sh backup_2026-05-24_02-00.tar.gz --db-only
#   ./restore.sh backup_2026-05-24_02-00.tar.gz --uploads-only
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

PROJECT_DIR="/home/users/sascha/support/ze-ticket"
DB_CONTAINER="ze_ticket_db"

hr() { echo -e "${CYAN}────────────────────────────────────────────────────${NC}"; }
log_ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_info() { echo -e "${CYAN}[INFO]${NC}  $1"; }

hr
echo -e "${CYAN}🔄 ZE-Ticket Restore — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
hr

# ── Argumente prüfen ──
ARCHIVE="$1"
RESTORE_DB=true
RESTORE_UPLOADS=true

if [[ "$2" == "--db-only" ]];      then RESTORE_UPLOADS=false; fi
if [[ "$2" == "--uploads-only" ]]; then RESTORE_DB=false; fi

if [[ -z "$ARCHIVE" ]]; then
    log_err "Kein Backup-Archiv angegeben."
    echo "Verwendung: $0 <backup.tar.gz> [--db-only|--uploads-only]"
    exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
    log_err "Datei nicht gefunden: $ARCHIVE"
    exit 1
fi

# ── .env laden ──
if [[ ! -f "${PROJECT_DIR}/.env" ]]; then
    log_err ".env nicht gefunden unter ${PROJECT_DIR}/.env"
    exit 1
fi
set -a
source <(sed 's/=\(.*\)/="\1"/' "${PROJECT_DIR}/.env" | grep -v "^#" | grep -v "^$")
set +a

# ── Bestätigung ──
echo -e "${YELLOW}⚠️  ACHTUNG: Bestehende Daten werden überschrieben!${NC}"
echo -e "   Archiv:  ${ARCHIVE}"
echo -e "   DB:      ${RESTORE_DB}"
echo -e "   Uploads: ${RESTORE_UPLOADS}"
echo ""
read -p "Fortfahren? (ja/nein): " confirm
if [[ "$confirm" != "ja" ]]; then
    echo "Abgebrochen."
    exit 0
fi

# ── Archiv entpacken ──
TMPDIR=$(mktemp -d)
log_info "Entpacke Archiv..."
tar -xzf "$ARCHIVE" -C "$TMPDIR" 2>/dev/null
if [[ $? -ne 0 ]]; then
    log_err "Archiv konnte nicht entpackt werden."
    rm -rf "$TMPDIR"
    exit 1
fi
log_ok "Archiv entpackt nach ${TMPDIR}"

# ── Datenbank wiederherstellen ──
if [[ "$RESTORE_DB" == true ]]; then
    DB_FILE="${TMPDIR}/database.sql"
    if [[ ! -f "$DB_FILE" ]]; then
        log_warn "database.sql nicht im Archiv gefunden — DB-Restore übersprungen"
    else
        log_info "Stelle Datenbank wieder her..."
        docker exec -i "$DB_CONTAINER" \
            psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$DB_FILE" 2>/dev/null
        if [[ $? -eq 0 ]]; then
            log_ok "Datenbank wiederhergestellt"
        else
            log_err "Datenbank-Restore fehlgeschlagen"
        fi
    fi
fi

# ── Uploads wiederherstellen ──
if [[ "$RESTORE_UPLOADS" == true ]]; then
    UPLOADS_SRC="${TMPDIR}/uploads"
    UPLOADS_DST="${PROJECT_DIR}/backend/uploads"
    if [[ ! -d "$UPLOADS_SRC" ]]; then
        log_warn "uploads/ nicht im Archiv — Uploads-Restore übersprungen"
    else
        log_info "Stelle Uploads wieder her..."
        if [[ -d "$UPLOADS_DST" ]]; then
            mv "$UPLOADS_DST" "${UPLOADS_DST}_backup_$(date +%Y%m%d%H%M%S)"
        fi
        cp -r "$UPLOADS_SRC" "$UPLOADS_DST"
        log_ok "Uploads wiederhergestellt"
    fi
fi

# ── Aufräumen ──
rm -rf "$TMPDIR"

hr
log_ok "Restore abgeschlossen"
echo -e "${YELLOW}Hinweis: Backend neu starten um Änderungen zu aktivieren:${NC}"
echo -e "  docker restart ze_ticket_backend"
hr
