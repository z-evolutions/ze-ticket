# Changelog

Alle wesentlichen Änderungen an ZE-Ticket werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/).

---

## [1.0.0-beta] — 2026-05-25

### Erstveröffentlichung

Erste stabile Version von ZE-Ticket — vollständig selbst gehostetes, DSGVO-konformes Ticketsystem.

### Features
- Ticket-Management (Erstellen, zuweisen, kommentieren, kategorisieren)
- Multi-Rollen-System (Superadmin, Admin, Manager, Agent, Kunde)
- Konfigurierbare Ticket-Sichtbarkeit für Agenten
- Ticket-Zugriffsschutz nach Gruppen (Backend-seitig validiert)
- Agent-Zuweisung nur für Gruppenmitglieder
- "Ticket übernehmen" Button (Self-Assign)
- Ticket-Freigabe beim Entfernen aus einer Gruppe
- Kunden-Portal (öffentliches Formular + Kunden-Login, 3-Faktor)
- E-Mail-Integration (SMTP ausgehend + IMAP-Polling eingehend)
- SLA-Management (Fristen, Eskalationen, Transparenz-Option)
- WebSocket-Echtzeit-Updates (kein Polling)
- Toast-Benachrichtigungen (smart gefiltert)
- Benachrichtigungs-Glocken in NavBar (🔔 Tickets + 💬 Kommentare)
- Volltextsuche (Elasticsearch)
- Backup-System (Lokal, WebDAV, SFTP, S3-kompatibel)
- Vollständiges Admin-Panel mit 10 Tabs
- Betreiber-Daten + Variablen in Datenschutz/Impressum
- App-Name editierbar (DB), App-URL read-only (.env)
- Mehrsprachigkeit DE/EN (neue Sprachen per JSON-Datei)
- Flaggen-Icons im Sprachumschalter
- Passwort-Stärke-Anzeige
- Dark/Light Mode
- Inter-Font überall

### Sicherheit
- JWT + bcrypt + Rate Limiting
- CORS-Schutz
- Security Headers (CSP, X-Frame-Options, XSS-Protection)
- Fernet/AES-Verschlüsselung für sensible Config-Werte
- DSGVO Art. 17 — Datenlöschung auf Anfrage
- Audit-Log (90 Tage Aufbewahrung)
- 0 bekannte CVEs bei Veröffentlichung

### Tests
- 27 Backend-Tests (pytest)
- 18 Frontend-Tests (vitest)
- `make test` für einfache Ausführung

### Infrastruktur
- Vollautomatisches `install.sh` für Debian/Ubuntu
- `docker-compose.prod.yml` für Produktionsbetrieb
- Webserver-Konfigurationsbeispiele (Apache, Nginx, Cloudflare)
- `backup.sh`, `restore.sh` für manuelle Operationen

---

## Format für zukünftige Einträge

```markdown
## [VERSION] — DATUM

### Hinzugefügt
- Neue Funktion XY

### Geändert
- Verhalten von XY angepasst

### Behoben
- Fehler bei XY behoben

### Sicherheit
- CVE-XXXX-YYYY behoben (Paket auf Version X.Y.Z aktualisiert)

### Entfernt
- Veraltete Funktion XY entfernt
```
