import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import NavBar from '../components/NavBar'
import './MaintenancePage.css'

const PHASES = [
  { id: 'phase1', title: 'Phase 1 — Foundation', icon: '🏗️', items: [
    { key: 'p1_docker',   label: 'Projekt-Setup (Docker, FastAPI, PostgreSQL, Redis, Elasticsearch)' },
    { key: 'p1_models',   label: 'Datenbankmodelle (User, Ticket, Group, SLA, Comment, Attachment)' },
    { key: 'p1_auth',     label: 'Auth-System (JWT, bcrypt, Einmalpasswort-Logik)' },
    { key: 'p1_mail',     label: 'Mail-System (SMTP-Client, Jinja2-Templates)' },
    { key: 'p1_auth_api', label: 'Auth-API (Login, Onboarding, Refresh, Logout, Passwort-Reset)' },
    { key: 'p1_alembic',  label: 'Alembic Migrationen — alle Tabellen angelegt' },
  ]},
  { id: 'phase2', title: 'Phase 2 — Frontend Grundgerüst', icon: '🎨', items: [
    { key: 'p2_vite',      label: 'React 19 + Vite Build-Pipeline' },
    { key: 'p2_design',    label: 'Z-Evolutions Design-System (CSS-Variablen, Orbitron, Cyan/Navy, Glassmorphism)' },
    { key: 'p2_theme',     label: 'Dark/Light Mode (ThemeContext + localStorage)' },
    { key: 'p2_apache',    label: 'Apache Reverse Proxy (/api/ → FastAPI, /ws/ → WebSocket)' },
    { key: 'p2_auth_ctx',  label: 'AuthContext: JWT-Verwaltung, login(), logout(), /api/auth/me' },
    { key: 'p2_routes',    label: 'Protected Routes' },
    { key: 'p2_login',     label: 'Login-Seite gegen echte API' },
    { key: 'p2_dashboard', label: 'Dashboard-Grundgerüst' },
  ]},
  { id: 'phase3', title: 'Phase 3 — Kernfunktionen', icon: '⚙️', items: [
    { key: 'p3_ticket_api',    label: 'Ticket-API (CRUD, Stats, Kommentare)' },
    { key: 'p3_ticket_num',    label: 'Ticket-Nummerierung ZE-YYYY-NNNN' },
    { key: 'p3_ticket_list',   label: 'Ticket-Liste mit Filtern + Paginierung' },
    { key: 'p3_ticket_detail', label: 'Ticket-Detail-Seite' },
    { key: 'p3_status',        label: 'Status + Priorität ändern + System-Notizen (Audit-Trail)' },
    { key: 'p3_comments',      label: 'Kommentare (Antwort + Interne Notiz)' },
    { key: 'p3_new_ticket',    label: 'Neues Ticket erstellen (Formular mit Tag-Eingabe)' },
    { key: 'p3_dashboard',     label: 'Dashboard ausgebaut (Stats, klickbare Karten, Vorschau-Listen)' },
    { key: 'p3_users',         label: 'Benutzerverwaltung (anlegen, bearbeiten, deaktivieren, Reset)' },
    { key: 'p3_agent_assign',  label: 'Agent-Zuweisung im Ticket (Dropdown mit echten Usern)' },
    { key: 'p3_onboarding',    label: 'Onboarding-Flow (Einmalpasswort ändern)' },
    { key: 'p3_imap',          label: 'E-Mail eingehend: IMAP-Polling → Ticket erstellen' },
    { key: 'p3_smtp_confirm',  label: 'E-Mail ausgehend: Bestätigungsmail bei neuem Ticket' },
    { key: 'p3_smtp_reply',    label: 'E-Mail ausgehend: Antwortmail bei Agent-Kommentar' },
    { key: 'p3_smtp_invite',   label: 'E-Mail ausgehend: Einladungsmail bei User-Anlage / Reset' },
    { key: 'p3_i18n',          label: 'i18n-Grundstruktur (de/en Keys, NavBar Sprachwechsel)' },
    { key: 'p3_groups',        label: 'Gruppen und Rollen' },
    { key: 'p3_portal',        label: 'Kunden-Portal' },
    { key: 'p3_websocket',     label: 'Echtzeit-Updates (WebSocket)' },
  ]},
  { id: 'phase4', title: 'Phase 4 — Erweiterte Features', icon: '🚀', items: [
    { key: 'p4_sla',    label: 'SLA-System (mit Transparenz-Option)' },
    { key: 'p4_search', label: 'Elasticsearch-Suche' },
    { key: 'p4_avatar', label: 'Avatar-Upload' },
    { key: 'p4_admin',  label: 'Vollständiger Adminbereich' },
    { key: 'p4_i18n',   label: 'Mehrsprachigkeit (i18n): alle Texte DE/EN vollständig' },
  ]},
  { id: 'phase5', title: 'Phase 5 — Setup-Wizard & Installer', icon: '🧙', items: [
    { key: 'p5_entrypoint', label: 'entrypoint.sh: Alembic-Migration automatisch beim Container-Start' },
    { key: 'p5_setup_api',  label: 'GET /api/setup/status → {setup_required: true/false}' },
    { key: 'p5_setup_ui',   label: 'Setup-Wizard Frontend (/setup): Systemname, Admin, SMTP, Abschluss' },
    { key: 'p5_installer',  label: 'install.sh Script (Docker-Check, .env generieren, Compose starten)' },
  ]},
  { id: 'phase6', title: 'Phase 6 — Produktionsreife', icon: '✅', items: [
    { key: 'p6_tests',      label: 'Tests (Unit + Integration)' },
    { key: 'p6_security',   label: 'Sicherheits-Audit' },
    { key: 'p6_docs',       label: 'Dokumentation' },
    { key: 'p6_opensource', label: 'Open Source unter AGPL-Lizenz veröffentlichen' },
  ]},
]

export default function MaintenancePage() {
  const { t } = useTranslation()
  const [checklist, setChecklist] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(null)

  useEffect(() => { loadChecklist() }, [])

  async function loadChecklist() {
    try { const res = await axios.get('/api/maintenance/'); setChecklist(res.data) }
    catch (e) { console.error('Checklist laden fehlgeschlagen:', e) }
    finally { setLoading(false) }
  }

  async function toggle(key, current) {
    setSaving(key)
    const newVal = !current
    setChecklist(prev => ({ ...prev, [key]: newVal }))
    try { const res = await axios.patch('/api/maintenance/', { key, checked: newVal }); setChecklist(res.data) }
    catch { setChecklist(prev => ({ ...prev, [key]: current })) }
    finally { setSaving(null) }
  }

  const allItems = PHASES.flatMap(p => p.items)
  const doneCount = allItems.filter(i => checklist[i.key]).length
  const totalCount = allItems.length
  const pct = Math.round((doneCount / totalCount) * 100)

  return (
    <div className="maint-page">
      <NavBar />
      <main className="maint-main">
        <div className="maint-hero glass">
          <div>
            <h1 className="maint-hero__title">{t('maintenance.title')}</h1>
            <p className="maint-hero__sub">{t('maintenance.subtitle')}</p>
          </div>
          <div className="maint-progress-wrap">
            <div className="maint-progress-bar">
              <div className="maint-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="maint-progress-label">
              <span className="maint-progress-pct">{pct}%</span>
              <span className="maint-progress-count">{t('maintenance.progress_label', { done: doneCount, total: totalCount })}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="maint-loading"><div className="maint-spinner" /><span>{t('maintenance.loading')}</span></div>
        ) : (
          <div className="maint-phases">
            {PHASES.map(phase => {
              const phaseDone = phase.items.filter(i => checklist[i.key]).length
              const phaseTotal = phase.items.length
              const phasePct = Math.round((phaseDone / phaseTotal) * 100)
              const phaseComplete = phaseDone === phaseTotal
              return (
                <div key={phase.id} className={`maint-phase glass ${phaseComplete ? 'maint-phase--complete' : ''}`}>
                  <div className="maint-phase__header">
                    <div className="maint-phase__title-wrap">
                      <span className="maint-phase__icon">{phase.icon}</span>
                      <h2 className="maint-phase__title">{phase.title}</h2>
                    </div>
                    <div className="maint-phase__stats">
                      <span className="maint-phase__count">{phaseDone}/{phaseTotal}</span>
                      <div className="maint-phase__bar">
                        <div className="maint-phase__bar-fill" style={{ width: `${phasePct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="maint-items">
                    {phase.items.map(item => {
                      const checked = !!checklist[item.key]
                      const isSaving = saving === item.key
                      return (
                        <label key={item.key} className={`maint-item ${checked ? 'maint-item--done' : ''} ${isSaving ? 'maint-item--saving' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(item.key, checked)} disabled={isSaving} />
                          <span className="maint-item__label">{item.label}</span>
                          {isSaving && <span className="maint-item__spinner" />}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
