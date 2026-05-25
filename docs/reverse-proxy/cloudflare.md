# Cloudflare-Konfiguration

ZE-Ticket funktioniert hervorragend hinter Cloudflare. Diese Anleitung erklärt die empfohlene Konfiguration.

## Empfohlener SSL-Modus: Full (strict)

In Cloudflare unter **SSL/TLS → Übersicht**:

| Modus | Geeignet | Beschreibung |
|---|---|---|
| Flexible | ❌ | HTTPS nur bis Cloudflare, dann HTTP zum Server — unsicher |
| Full | ⚠️ | HTTPS zum Server, aber Zertifikat wird nicht verifiziert |
| **Full (strict)** | ✅ | HTTPS zum Server + Zertifikatsverifikation — empfohlen |

## Cloudflare Origin CA Zertifikat

Mit **Full (strict)** benötigt der Webserver ein gültiges Zertifikat. Dafür eignet sich das **Cloudflare Origin CA Zertifikat** — kostenlos und 15 Jahre gültig.

### Zertifikat erstellen

In Cloudflare unter **SSL/TLS → Ursprungsserver → Zertifikat erstellen**:

1. Schlüsseltyp: RSA (2048)
2. Hostnames: `ihre-domain.de`, `*.ihre-domain.de`
3. Gültigkeit: 15 Jahre
4. Zertifikat + Private Key auf dem Server speichern

### Cloudflare Origin CA dem Server bekannt machen

Damit der Webserver Verbindungen von Cloudflare verifizieren kann:

```bash
# Cloudflare Root CA herunterladen
mkdir -p /etc/ssl/cloudflare
wget https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem \
     -O /etc/ssl/cloudflare/cloudflare.crt
```

**Apache** — in der VHost-Konfiguration:
```apache
SSLCACertificateFile /etc/ssl/cloudflare/cloudflare.crt
SSLVerifyClient require
SSLVerifyDepth 1
```

**Nginx** — in der Server-Konfiguration:
```nginx
ssl_client_certificate /etc/ssl/cloudflare/cloudflare.crt;
ssl_verify_client on;
```

> ⚠️ Mit `SSLVerifyClient require` / `ssl_verify_client on` werden **nur noch Cloudflare-Verbindungen** akzeptiert. Direktzugriffe auf die Server-IP werden geblockt — das ist gewollt.

## Cloudflare Firewall-Regeln (empfohlen)

Unter **Sicherheit → WAF** können folgende Regeln den Schutz erhöhen:

- Direktzugriffe auf Server-IP blockieren
- Länder-Blocking (falls gewünscht)
- Bot-Schutz aktivieren

## Wichtig: WebSocket

Cloudflare unterstützt WebSockets. Stelle sicher dass unter **Netzwerk → WebSockets** die Option aktiviert ist.

## Cloudflare und Docker-Mailserver

Wenn der Mailserver auf demselben Server läuft und Docker SMTP/IMAP nutzt, muss die Docker-Netzwerk-Range (Standard: `172.20.0.0/16`) in der Server-Firewall für die Mail-Ports freigegeben sein — Cloudflare routet keinen Mail-Traffic.
