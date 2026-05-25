# Apache mit Keyhelp ACP

Diese Anleitung gilt für Installationen mit dem **Keyhelp Control Panel** und **Cloudflare** als CDN/SSL-Proxy.

## Voraussetzungen

- Keyhelp ACP installiert und konfiguriert
- Domain in Keyhelp angelegt (z.B. `support.ihre-domain.de`)
- Cloudflare als DNS/Proxy aktiv
- Cloudflare SSL-Modus: **Full (strict)**

## Schritt 1 — Cloudflare Origin CA einrichten

Damit Apache Cloudflare-Verbindungen verifizieren kann, muss die Cloudflare Origin CA hinterlegt werden:

```bash
# Cloudflare Origin CA herunterladen
wget https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem \
     -O /etc/ssl/cloudflare/cloudflare.crt

# Verzeichnis anlegen falls nicht vorhanden
mkdir -p /etc/ssl/cloudflare
```

## Schritt 2 — Custom VHost in Keyhelp anlegen

In Keyhelp unter **Domains → Ihre Domain → Apache-Konfiguration → Custom VHost (HTTPS)** folgende Konfiguration eintragen:

```apache
<Directory "/home/users/IHR_USER/www/support.ihre-domain.de/">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource /index.html
</Directory>

# API Proxy → FastAPI Backend
ProxyRequests Off
ProxyPreserveHost On
ProxyPass /uploads/ http://127.0.0.1:8000/uploads/
ProxyPassReverse /uploads/ http://127.0.0.1:8000/uploads/
ProxyPass /api/ http://127.0.0.1:8000/api/
ProxyPassReverse /api/ http://127.0.0.1:8000/api/

# WebSocket → FastAPI WebSocket
ProxyPass /ws/ ws://127.0.0.1:8000/ws/
ProxyPassReverse /ws/ ws://127.0.0.1:8000/ws/

# Security Headers
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-Content-Type-Options "nosniff"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' wss://ihre-domain.de; frame-ancestors 'none';"

# Cloudflare Origin CA — nur Cloudflare-Verbindungen erlauben
SSLCACertificateFile /etc/ssl/cloudflare/cloudflare.crt
SSLVerifyClient require
SSLVerifyDepth 1
```

**Wichtig:** Ersetze `IHR_USER` und `ihre-domain.de` mit deinen tatsächlichen Werten.

## Schritt 3 — Frontend-Build verlinken

Das React-Frontend wird als statischer Build ausgeliefert. Keyhelp erwartet die Dateien unter dem konfigurierten Web-Root:

```bash
# Symlink vom Keyhelp Web-Root zum dist/-Verzeichnis
ln -sf /pfad/zu/ze-ticket/frontend/dist/* \
       /home/users/IHR_USER/www/support.ihre-domain.de/
```

Oder alternativ nach jedem `npm run build` die Dateien kopieren:

```bash
cp -r /pfad/zu/ze-ticket/frontend/dist/* \
      /home/users/IHR_USER/www/support.ihre-domain.de/
```

## Schritt 4 — Keyhelp Firewall

Damit Docker den Mailserver erreichen kann, muss die Docker-Netzwerk-Range in der Keyhelp-Firewall freigegeben werden:

- **Port 465** (SMTP SSL) für `172.20.0.0/16`
- **Port 993** (IMAP SSL) für `172.20.0.0/16`

Dies ist in Keyhelp unter **Server → Firewall** konfigurierbar.

## Troubleshooting

**Problem:** 502 Bad Gateway bei `/api/`
**Lösung:** Prüfe ob der Backend-Container läuft: `docker ps | grep ze_ticket_backend`

**Problem:** WebSocket-Verbindung schlägt fehl
**Lösung:** Stelle sicher dass `proxy_wstunnel` aktiviert ist: `a2enmod proxy_wstunnel`

**Problem:** SSL-Fehler / 403 bei Cloudflare
**Lösung:** Cloudflare SSL-Modus muss auf **Full (strict)** stehen, nicht "Flexible"
