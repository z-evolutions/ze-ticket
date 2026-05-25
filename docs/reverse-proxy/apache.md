# Apache Standalone (ohne Panel)

Diese Anleitung gilt für eine **direkte Apache-Installation** ohne Control Panel, mit **Let's Encrypt** als SSL-Zertifikat.

## Voraussetzungen

```bash
# Apache + Certbot installieren
apt-get install -y apache2 certbot python3-certbot-apache

# Benötigte Module aktivieren
a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
systemctl restart apache2
```

## VirtualHost-Konfiguration

Datei anlegen: `/etc/apache2/sites-available/ze-ticket.conf`

```apache
<VirtualHost *:80>
    ServerName support.ihre-domain.de
    # HTTP → HTTPS Redirect
    RewriteEngine On
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName support.ihre-domain.de

    # SSL (von Certbot automatisch ausgefüllt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/support.ihre-domain.de/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/support.ihre-domain.de/privkey.pem

    # Frontend — React Build
    DocumentRoot /pfad/zu/ze-ticket/frontend/dist

    <Directory "/pfad/zu/ze-ticket/frontend/dist">
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

    ErrorLog ${APACHE_LOG_DIR}/ze-ticket-error.log
    CustomLog ${APACHE_LOG_DIR}/ze-ticket-access.log combined
</VirtualHost>
```

## Site aktivieren

```bash
a2ensite ze-ticket.conf
systemctl reload apache2
```

## SSL-Zertifikat mit Let's Encrypt

```bash
certbot --apache -d support.ihre-domain.de
```

Certbot ergänzt die SSL-Direktiven automatisch.

## Automatische Zertifikatserneuerung testen

```bash
certbot renew --dry-run
```
