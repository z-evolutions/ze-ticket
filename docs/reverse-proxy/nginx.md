# Nginx Standalone

Diese Anleitung gilt für eine **direkte Nginx-Installation** mit **Let's Encrypt** als SSL-Zertifikat.

## Voraussetzungen

```bash
# Nginx + Certbot installieren
apt-get install -y nginx certbot python3-certbot-nginx
```

## Server-Konfiguration

Datei anlegen: `/etc/nginx/sites-available/ze-ticket`

```nginx
# HTTP → HTTPS Redirect
server {
    listen 80;
    server_name support.ihre-domain.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name support.ihre-domain.de;

    # SSL (von Certbot automatisch ausgefüllt)
    ssl_certificate /etc/letsencrypt/live/support.ihre-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/support.ihre-domain.de/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend — React Build
    root /pfad/zu/ze-ticket/frontend/dist;
    index index.html;

    # API Proxy → FastAPI Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads Proxy → FastAPI Backend
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }

    # WebSocket → FastAPI WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # React Router — alle anderen Routen an index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' wss://ihre-domain.de; frame-ancestors 'none';" always;

    access_log /var/log/nginx/ze-ticket-access.log;
    error_log /var/log/nginx/ze-ticket-error.log;
}
```

## Site aktivieren

```bash
ln -s /etc/nginx/sites-available/ze-ticket /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## SSL-Zertifikat mit Let's Encrypt

```bash
certbot --nginx -d support.ihre-domain.de
```

## Automatische Zertifikatserneuerung testen

```bash
certbot renew --dry-run
```
