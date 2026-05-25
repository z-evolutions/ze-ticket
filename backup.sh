#!/bin/bash
# ============================================================
# ZE-Ticket — Backup Script
# ============================================================
# Sichert PostgreSQL-Datenbank + Uploads
# DSGVO-konform: Logging, Verschlüsselung, konfigurierbare
# Aufbewahrung für Revisionssicherheit
#
# Verwendung:
#   ./backup.sh              — normales Backup
#   ./backup.sh --dry-run    — zeigt was gemacht würde, ohne auszuführen
# ============================================================

# ─── Konfiguration ─────────────────────────────────────────
BACKUP_DIR="/home/users/sascha/support/ze-ticket/backups"
PROJECT_DIR="/home/users/sascha/support/ze-ticket"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Aufbewahrung
RETENTION_DAYS=30           # Backups älter als X Tage werden gelöscht
RETENTION_MIN_COUNT=7       # Mindestens X Backups immer behalten (egal wie alt)

# Inhalte
BACKUP_DATABASE=true        # PostgreSQL-Dump sichern
BACKUP_UPLOADS=true         # Uploads-Verzeichnis sichern

# Komprimierung
COMPRESS=true               # Backup komprimieren (gzip)
COMPRESS_LEVEL=6            # Komprimierungsstufe 1 (schnell) bis 9 (maximal)

# Verschlüsselung (DSGVO: Backups enthalten personenbezogene Daten!)
ENCRYPT=false               # Verschlüsselung aktivieren (empfohlen für Offsite-Backups)
GPG_RECIPIENT=""            # GPG Key-ID oder E-Mail: z.B. "support@z-evolutions.de"

# Container
DB_CONTAINER="ze_ticket_db"
BACKEND_CONTAINER="ze_ticket_backend"

# ─── Farben für Ausgabe ────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Hilfsfunktionen ───────────────────────────────────────
log() {
    local level="$1"
    local msg="$2"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${ts} [${level}] ${msg}" >> "${LOG_FILE}"
    case "$level" in
        INFO)  echo -e "${CYAN}[INFO]${NC}  ${msg}" ;;
        OK)    echo -e "${GREEN}[OK]${NC}    ${msg}" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  ${msg}" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${msg}" ;;
    esac
}

hr() { echo -e "${CYAN}────────────────────────────────────────────────────${NC}"; }

# ─── Dry-Run Modus ─────────────────────────────────────────
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}⚠️  DRY-RUN Modus — keine Änderungen werden vorgenommen${NC}"
fi

# ─── Start ─────────────────────────────────────────────────
hr
echo -e "${CYAN}🗄️  ZE-Ticket Backup — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
hr

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
BACKUP_NAME="backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
ERRORS=0

# Verzeichnis anlegen
# Backup-Verzeichnis immer anlegen (auch im Dry-Run, für Log-Datei)
mkdir -p "${BACKUP_DIR}"

# Backup-Unterverzeichnis nur im echten Lauf anlegen
if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "${BACKUP_PATH}"
fi

# .env einlesen für DB-Zugangsdaten
if [[ -f "${PROJECT_DIR}/.env" ]]; then
    set -a
    source <(sed 's/=\(.*\)/="\1"/' "${PROJECT_DIR}/.env" | grep -v "^#" | grep -v "^$")
    set +a
else
    log "ERROR" ".env nicht gefunden unter ${PROJECT_DIR}/.env"
    exit 1
fi

# ─── PostgreSQL Backup ─────────────────────────────────────
if [[ "$BACKUP_DATABASE" == true ]]; then
    log "INFO" "Starte PostgreSQL-Dump..."
    DB_FILE="${BACKUP_PATH}/database.sql"

    if [[ "$DRY_RUN" == false ]]; then
        docker exec "${DB_CONTAINER}" \
            pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
            > "${DB_FILE}" 2>/dev/null

        if [[ $? -eq 0 && -s "${DB_FILE}" ]]; then
            DB_SIZE=$(du -sh "${DB_FILE}" | cut -f1)
            log "OK" "PostgreSQL-Dump erstellt (${DB_SIZE})"
        else
            log "ERROR" "PostgreSQL-Dump fehlgeschlagen"
            ERRORS=$((ERRORS + 1))
        fi
    else
        log "INFO" "[DRY-RUN] Würde pg_dump aus ${DB_CONTAINER} ausführen → ${DB_FILE}"
    fi
fi

# ─── Uploads Backup ────────────────────────────────────────
if [[ "$BACKUP_UPLOADS" == true ]]; then
    log "INFO" "Sichere Uploads-Verzeichnis..."
    UPLOADS_SRC="${PROJECT_DIR}/backend/uploads"
    UPLOADS_FILE="${BACKUP_PATH}/uploads.tar"

    if [[ -d "${UPLOADS_SRC}" ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            tar -cf "${UPLOADS_FILE}" -C "${PROJECT_DIR}/backend" uploads 2>/dev/null

            if [[ $? -eq 0 ]]; then
                UP_SIZE=$(du -sh "${UPLOADS_FILE}" | cut -f1)
                log "OK" "Uploads gesichert (${UP_SIZE})"
            else
                log "ERROR" "Uploads-Backup fehlgeschlagen"
                ERRORS=$((ERRORS + 1))
            fi
        else
            log "INFO" "[DRY-RUN] Würde Uploads sichern → ${UPLOADS_FILE}"
        fi
    else
        log "WARN" "Uploads-Verzeichnis nicht gefunden: ${UPLOADS_SRC}"
    fi
fi

# ─── Komprimierung ─────────────────────────────────────────
if [[ "$COMPRESS" == true ]]; then
    log "INFO" "Komprimiere Backup (Stufe ${COMPRESS_LEVEL})..."
    ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

    if [[ "$DRY_RUN" == false ]]; then
        GZIP="-${COMPRESS_LEVEL}" tar -czf "${ARCHIVE}" \
            -C "${BACKUP_DIR}" "${BACKUP_NAME}" 2>/dev/null

        if [[ $? -eq 0 ]]; then
            rm -rf "${BACKUP_PATH}"
            ARCHIVE_SIZE=$(du -sh "${ARCHIVE}" | cut -f1)
            log "OK" "Komprimiert → ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})"
            FINAL_FILE="${ARCHIVE}"
        else
            log "WARN" "Komprimierung fehlgeschlagen — unkomprimiertes Backup bleibt"
            FINAL_FILE="${BACKUP_PATH}"
        fi
    else
        log "INFO" "[DRY-RUN] Würde komprimieren → ${ARCHIVE}"
        FINAL_FILE="${ARCHIVE}"
    fi
else
    FINAL_FILE="${BACKUP_PATH}"
fi

# ─── Verschlüsselung ───────────────────────────────────────
if [[ "$ENCRYPT" == true ]]; then
    if [[ -z "$GPG_RECIPIENT" ]]; then
        log "WARN" "ENCRYPT=true aber GPG_RECIPIENT nicht gesetzt — Verschlüsselung übersprungen"
    else
        log "INFO" "Verschlüssele Backup für ${GPG_RECIPIENT}..."
        if [[ "$DRY_RUN" == false ]]; then
            gpg --batch --yes --recipient "${GPG_RECIPIENT}" \
                --output "${FINAL_FILE}.gpg" \
                --encrypt "${FINAL_FILE}" 2>/dev/null

            if [[ $? -eq 0 ]]; then
                rm -f "${FINAL_FILE}"
                FINAL_FILE="${FINAL_FILE}.gpg"
                log "OK" "Backup verschlüsselt → $(basename ${FINAL_FILE})"
            else
                log "ERROR" "Verschlüsselung fehlgeschlagen — unverschlüsseltes Backup bleibt"
                ERRORS=$((ERRORS + 1))
            fi
        else
            log "INFO" "[DRY-RUN] Würde verschlüsseln für ${GPG_RECIPIENT}"
        fi
    fi
fi

# ─── Alte Backups bereinigen ───────────────────────────────
log "INFO" "Prüfe alte Backups (Aufbewahrung: ${RETENTION_DAYS} Tage, mind. ${RETENTION_MIN_COUNT} behalten)..."

if [[ "$DRY_RUN" == false ]]; then
    # Alle Backup-Dateien nach Alter sortieren (neueste zuerst)
    mapfile -t ALL_BACKUPS < <(ls -t "${BACKUP_DIR}"/backup_*.tar.gz \
        "${BACKUP_DIR}"/backup_*.tar.gz.gpg 2>/dev/null)

    TOTAL=${#ALL_BACKUPS[@]}
    DELETED=0

    for i in "${!ALL_BACKUPS[@]}"; do
        FILE="${ALL_BACKUPS[$i]}"
        INDEX=$((i + 1))

        # Mindestanzahl immer behalten
        if [[ $INDEX -le $RETENTION_MIN_COUNT ]]; then
            continue
        fi

        # Nach Alter prüfen
        FILE_AGE=$(( ( $(date +%s) - $(stat -c %Y "${FILE}") ) / 86400 ))
        if [[ $FILE_AGE -gt $RETENTION_DAYS ]]; then
            rm -f "${FILE}"
            log "INFO" "Gelöscht (${FILE_AGE} Tage alt): $(basename ${FILE})"
            DELETED=$((DELETED + 1))
        fi
    done

    if [[ $DELETED -eq 0 ]]; then
        log "OK" "Keine alten Backups zu löschen (${TOTAL} Backups vorhanden)"
    else
        log "OK" "${DELETED} alte Backup(s) gelöscht"
    fi
else
    log "INFO" "[DRY-RUN] Würde Backups älter als ${RETENTION_DAYS} Tage prüfen"
fi

# ─── Abschluss ─────────────────────────────────────────────
hr
if [[ $ERRORS -eq 0 ]]; then
    log "OK" "Backup erfolgreich abgeschlossen"
    echo -e "${GREEN}✅ Backup fertig: $(basename ${FINAL_FILE})${NC}"
    EXIT_CODE=0
else
    log "ERROR" "Backup mit ${ERRORS} Fehler(n) abgeschlossen"
    echo -e "${RED}❌ Backup mit ${ERRORS} Fehler(n)${NC}"
    EXIT_CODE=1
fi
hr

exit $EXIT_CODE
