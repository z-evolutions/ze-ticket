#!/bin/bash
set -e

# ─── Cloudflare Origin CA — SSL-Vertrauen herstellen ──────────────────────────
# Wird bei jedem Start ausgeführt — überlebt Volume-Mounts
# Nötig weil Cloudflare Origin Certs keine öffentliche CA haben
echo "🔐 Installiere Cloudflare Origin CA..."
curl -sS https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem \
    -o /usr/local/share/ca-certificates/cloudflare_origin_ca.crt 2>/dev/null && \
    update-ca-certificates --fresh 2>/dev/null | grep -E "added|done" || \
    echo "⚠️  CA-Update übersprungen (kein curl/ca-certificates)"

echo "⏳ Warte auf PostgreSQL..."
until python -c "
import psycopg2, os, sys
url = os.environ['DATABASE_URL']
url = url.replace('postgresql+asyncpg://', '')
userpass, hostdb = url.split('@')
user, password = userpass.split(':')
hostport, db = hostdb.split('/')
host, port = hostport.split(':')
try:
    psycopg2.connect(host=host, port=port, user=user, password=password, dbname=db)
    print('✅ PostgreSQL bereit')
except Exception as e:
    print(f'⏳ Noch nicht bereit: {e}')
    sys.exit(1)
"; do
    sleep 2
done

echo "🔄 Führe Datenbankmigrationen aus..."
alembic upgrade head
echo "✅ Migrationen abgeschlossen"

echo "🚀 Starte ZE-Ticket Backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
