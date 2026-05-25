# Beitragen zu ZE-Ticket

Vielen Dank für dein Interesse an ZE-Ticket! Beiträge sind herzlich willkommen.

---

## Verhaltenskodex

Alle Beitragenden verpflichten sich zu einem respektvollen und konstruktiven Umgang. Diskriminierung, Belästigung oder unangemessenes Verhalten werden nicht toleriert.

---

## Wie kann ich beitragen?

### Fehler melden (Bug Report)

1. Prüfe zuerst ob das Issue bereits gemeldet wurde
2. Erstelle ein neues Issue mit dem Label `bug`
3. Beschreibe den Fehler so genau wie möglich:
   - Was hast du erwartet?
   - Was ist stattdessen passiert?
   - Schritte zur Reproduktion
   - Version von ZE-Ticket, Browser, Betriebssystem
4. Füge relevante Log-Ausgaben hinzu (ohne sensible Daten!)

### Feature vorschlagen

1. Erstelle ein Issue mit dem Label `enhancement`
2. Beschreibe den Anwendungsfall — warum ist das Feature nützlich?
3. Schlage eine mögliche Umsetzung vor (optional)

### Code beitragen (Pull Request)

1. Forke das Repository
2. Erstelle einen Feature-Branch:
   ```bash
   git checkout -b feature/mein-feature
   ```
3. Entwickle deine Änderungen
4. Stelle sicher dass alle Tests bestehen:
   ```bash
   make test
   ```
5. Committe mit aussagekräftiger Nachricht:
   ```bash
   git commit -m "feat: Neue Funktion XY hinzugefügt"
   ```
6. Pushe deinen Branch und erstelle einen Pull Request

---

## Entwicklungsumgebung einrichten

```bash
# Repository klonen
git clone https://github.com/z-evolutions/ze-ticket.git
cd ze-ticket

# Entwicklungsumgebung starten
docker compose up -d

# Frontend im Dev-Modus
cd frontend
npm install
npm run dev

# Backend-Abhängigkeiten (für lokale Entwicklung)
cd backend
pip install -r requirements-dev.txt

# Tests ausführen
make test
```

---

## Code-Style

### Backend (Python)
- PEP 8 — Standard Python Style Guide
- Async/await überall (kein synchrones SQLAlchemy)
- Docstrings für alle öffentlichen Funktionen
- Keine sensiblen Daten in Log-Ausgaben

### Frontend (React/JavaScript)
- Funktionale Komponenten + Hooks (keine Klassen-Komponenten)
- CSS-Klassen mit Seiten-Prefix (z.B. `dashboard-`, `tickets-`)
- Inter-Font — kein Orbitron oder andere Display-Fonts
- Alle Texte als i18n-Keys (keine hardcodierten Strings)

### Commits
Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Bedeutung |
|---|---|
| `feat:` | Neue Funktion |
| `fix:` | Bugfix |
| `docs:` | Dokumentation |
| `test:` | Tests |
| `refactor:` | Refactoring ohne neue Funktion |
| `security:` | Sicherheits-Fix |
| `chore:` | Wartungsarbeiten |

---

## Tests

Neue Funktionen müssen von Tests begleitet werden:

- **Backend:** `backend/tests/test_*.py` — pytest
- **Frontend:** `frontend/src/test/*.test.js(x)` — vitest

```bash
# Alle Tests
make test

# Nur Backend
make test-backend

# Nur Frontend
make test-frontend
```

---

## Sicherheitslücken melden

Sicherheitslücken bitte **nicht** als öffentliches Issue melden.
Sende eine E-Mail an: **security@z-evolutions.de**

Wir melden uns innerhalb von 72 Stunden.

---

## Lizenz

Mit deinem Beitrag stimmst du zu, dass dein Code unter der [AGPL-3.0 Lizenz](LICENSE) veröffentlicht wird.
