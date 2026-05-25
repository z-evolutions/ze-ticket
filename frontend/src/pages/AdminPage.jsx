import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { invalidateLogoCache } from '../hooks/useLogo'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import NavBar from '../components/NavBar'
import { formatDate } from '../utils/dateFormat'
import UsersPage from './UsersPage'
import GroupsPage from './GroupsPage'
import './AdminPage.css'

// ── Hilfsfunktion ──────────────────────────────────────────────────────────────


function minutesToReadable(min) {
  if (min < 60) return `${min} Min.`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ── Stat-Karte ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="admin-stat glass">
      <span className={`admin-stat__value ${color ? `admin-stat__value--${color}` : ''}`}>{value ?? '–'}</span>
      <span className="admin-stat__label">{label}</span>
    </div>
  )
}

// ── Tab: Übersicht ─────────────────────────────────────────────────────────────
function TabOverview({ t }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    axios.get('/api/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  if (!stats) return <div className="admin-loading">Lade Statistiken…</div>

  return (
    <div className="admin-overview">
      <h2 className="admin-section-title">Benutzer</h2>
      <div className="admin-stats-grid">
        <StatCard label={t('admin.stats_users_total')}  value={stats.users.total} />
        <StatCard label={t('admin.stats_users_active')} value={stats.users.active} color="cyan" />
        <StatCard label={t('admin.stats_users_agents')} value={stats.users.agents} color="warn" />
        <StatCard label={t('admin.stats_users_kunden')} value={stats.users.kunden} />
      </div>

      <h2 className="admin-section-title">Tickets</h2>
      <div className="admin-stats-grid">
        <StatCard label={t('admin.stats_tickets_total')}    value={stats.tickets.total} />
        <StatCard label={t('admin.stats_tickets_neu')}      value={stats.tickets.neu} color="cyan" />
        <StatCard label={t('admin.stats_tickets_progress')} value={stats.tickets.in_bearbeitung} color="warn" />
        <StatCard label={t('admin.stats_tickets_done')}     value={stats.tickets.geloest} color="success" />
        <StatCard label={t('admin.stats_tickets_closed')}   value={stats.tickets.geschlossen} />
        <StatCard label={t('admin.stats_tickets_sla')}      value={stats.tickets.sla_breached} color="error" />
      </div>

      <h2 className="admin-section-title">Gruppen & SLA</h2>
      <div className="admin-stats-grid">
        <StatCard label={t('admin.stats_groups_total')}  value={stats.groups.total} />
        <StatCard label={t('admin.stats_groups_active')} value={stats.groups.active} color="cyan" />
        <StatCard label={t('admin.stats_slas_total')}    value={stats.slas.total} />
        <StatCard label={t('admin.stats_slas_active')}   value={stats.slas.active} color="cyan" />
      </div>
    </div>
  )
}

// ── Tab: SLA ───────────────────────────────────────────────────────────────────
const EMPTY_SLA = {
  name: '', description: '', response_time_minutes: 60,
  resolution_time_minutes: 480, priority_scope: 'alle',
  group_id: null, is_public: false, is_active: true,
}

function TabSLA({ t }) {
  const [slas,   setSlas]   = useState([])
  const [groups, setGroups] = useState([])
  const [modal,  setModal]  = useState(null)   // null | 'new' | sla-object
  const [form,   setForm]   = useState(EMPTY_SLA)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const load = useCallback(() => {
    axios.get('/api/admin/slas').then(r => setSlas(r.data)).catch(() => {})
    axios.get('/api/groups/').then(r => setGroups(r.data.groups || [])).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setForm(EMPTY_SLA); setModal('new'); setError(null) }
  function openEdit(sla) {
    setForm({
      name: sla.name, description: sla.description || '',
      response_time_minutes: sla.response_time_minutes,
      resolution_time_minutes: sla.resolution_time_minutes,
      priority_scope: sla.priority_scope,
      group_id: sla.group_id || null,
      is_public: sla.is_public, is_active: sla.is_active,
    })
    setModal(sla)
    setError(null)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const payload = { ...form,
        response_time_minutes: parseInt(form.response_time_minutes),
        resolution_time_minutes: parseInt(form.resolution_time_minutes),
        group_id: form.group_id || null,
      }
      if (modal === 'new') {
        await axios.post('/api/admin/slas', payload)
      } else {
        await axios.patch(`/api/admin/slas/${modal.id}`, payload)
      }
      load(); setModal(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sla) {
    if (!confirm(t('admin.sla_delete_confirm'))) return
    await axios.delete(`/api/admin/slas/${sla.id}`)
    load()
  }

  return (
    <div className="admin-sla">
      <div className="admin-toolbar">
        <button className="admin-btn-primary" onClick={openNew}>{t('admin.sla_new')}</button>
      </div>

      <div className="admin-table-wrap glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.sla_name')}</th>
              <th>{t('admin.sla_response')}</th>
              <th>{t('admin.sla_resolution')}</th>
              <th>{t('admin.sla_priority')}</th>
              <th>{t('admin.sla_group')}</th>
              <th>{t('admin.sla_public')}</th>
              <th>{t('admin.sla_active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slas.length === 0 ? (
              <tr><td colSpan={8} className="admin-empty">Keine SLA-Regeln vorhanden.</td></tr>
            ) : slas.map(sla => (
              <tr key={sla.id}>
                <td><strong>{sla.name}</strong>{sla.description && <div className="admin-sub">{sla.description}</div>}</td>
                <td>{minutesToReadable(sla.response_time_minutes)}</td>
                <td>{minutesToReadable(sla.resolution_time_minutes)}</td>
                <td><span className="admin-badge">{sla.priority_scope}</span></td>
                <td>{sla.group_name || '—'}</td>
                <td>{sla.is_public ? '✓' : '—'}</td>
                <td><span className={`admin-status ${sla.is_active ? 'admin-status--active' : 'admin-status--inactive'}`}>{sla.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                <td className="admin-actions">
                  <button className="admin-btn-sm" onClick={() => openEdit(sla)}>Bearbeiten</button>
                  <button className="admin-btn-sm admin-btn-sm--danger" onClick={() => handleDelete(sla)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="admin-modal glass">
            <div className="admin-modal__header">
              <h3>{modal === 'new' ? t('admin.sla_new') : `SLA bearbeiten: ${modal.name}`}</h3>
              <button className="admin-modal__close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="admin-modal__body">
              <div className="admin-form-field">
                <label>{t('admin.sla_name')}</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="admin-form-field">
                <label>{t('admin.sla_description')}</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>{t('admin.sla_response')} ({t('admin.sla_minutes')})</label>
                  <input type="number" min="1" value={form.response_time_minutes}
                    onChange={e => setForm(p => ({ ...p, response_time_minutes: e.target.value }))} />
                </div>
                <div className="admin-form-field">
                  <label>{t('admin.sla_resolution')} ({t('admin.sla_minutes')})</label>
                  <input type="number" min="1" value={form.resolution_time_minutes}
                    onChange={e => setForm(p => ({ ...p, resolution_time_minutes: e.target.value }))} />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>{t('admin.sla_priority')}</label>
                  <select value={form.priority_scope} onChange={e => setForm(p => ({ ...p, priority_scope: e.target.value }))}>
                    <option value="alle">Alle</option>
                    <option value="niedrig">Niedrig</option>
                    <option value="normal">Normal</option>
                    <option value="hoch">Hoch</option>
                    <option value="kritisch">Kritisch</option>
                  </select>
                </div>
                <div className="admin-form-field">
                  <label>{t('admin.sla_group')}</label>
                  <select value={form.group_id || ''} onChange={e => setForm(p => ({ ...p, group_id: e.target.value || null }))}>
                    <option value="">{t('admin.sla_no_group')}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-row">
                <label className="admin-checkbox-label">
                  <input type="checkbox" checked={form.is_public}
                    onChange={e => setForm(p => ({ ...p, is_public: e.target.checked }))} />
                  {t('admin.sla_public')} (im Kundenportal sichtbar)
                </label>
                <label className="admin-checkbox-label">
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  {t('admin.sla_active')}
                </label>
              </div>
              {error && <div className="admin-error">{error}</div>}
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn-secondary" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('admin.sla_saving') : t('admin.sla_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Audit-Log ─────────────────────────────────────────────────────────────
function TabAudit({ t }) {
  const [entries,    setEntries]    = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [filterAction, setFilterAction] = useState('')
  const PAGE_SIZE = 50

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, page_size: PAGE_SIZE })
    if (filterAction) params.append('action', filterAction)
    axios.get(`/api/admin/audit-log?${params}`)
      .then(r => { setEntries(r.data.entries); setTotal(r.data.total) })
      .catch(() => {})
  }, [page, filterAction])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="admin-audit">
      <div className="admin-toolbar">
        <input className="admin-filter-input" placeholder={t('admin.audit_filter_action')}
          value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }} />
      </div>

      <div className="admin-table-wrap glass">
        <table className="admin-table admin-table--audit">
          <thead>
            <tr>
              <th>{t('admin.audit_time')}</th>
              <th>{t('admin.audit_user')}</th>
              <th>{t('admin.audit_action')}</th>
              <th>{t('admin.audit_resource')}</th>
              <th>{t('admin.audit_detail')}</th>
              <th>{t('admin.audit_ip')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="admin-empty">{t('admin.audit_empty')}</td></tr>
            ) : entries.map(e => (
              <tr key={e.id}>
                <td className="admin-date">{formatDate(e.created_at)}</td>
                <td>{e.user_display_name || '—'}</td>
                <td><span className="admin-action-badge">{e.action}</span></td>
                <td>{e.resource_label ? <><span className="admin-sub">{e.resource_type}</span> {e.resource_label}</> : '—'}</td>
                <td className="admin-detail">{e.detail || '—'}</td>
                <td className="admin-ip">{e.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Zurück</button>
          <span>Seite {page} / {totalPages} ({total} Einträge)</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Weiter →</button>
        </div>
      )}
    </div>
  )
}

// ── Tab: System ────────────────────────────────────────────────────────────────
function TabSystem({ t }) {
  const [settings,     setSettings]     = useState(null)
  const [logoUrl,      setLogoUrl]      = useState(null)
  const [logoMsg,      setLogoMsg]      = useState(null)
  const [privacyText,  setPrivacyText]  = useState('')
  const [imprintText,  setImprintText]  = useState('')
  const [textSaving,   setTextSaving]   = useState(null)
  const [textMsg,      setTextMsg]      = useState(null)
  const fileRef = useRef(null)

  // App-Einstellungen
  const [appName, setAppName]         = useState('')
  const [appNameSaving, setAppNameSaving] = useState(false)
  const [appNameMsg,    setAppNameMsg]    = useState(null)

  // Betreiber-Daten
  const [company, setCompany]       = useState({ company_name: '', company_street: '', company_zip: '', company_email: '', company_phone: '', company_owner: '' })
  const [companySaving, setCompanySaving] = useState(false)
  const [companyMsg,    setCompanyMsg]    = useState(null)

  // Ticket-Sichtbarkeit + Gruppen-Kacheln
  const [ticketVisibility, setTicketVisibility] = useState('own_and_unassigned')
  const [showGroupTiles,   setShowGroupTiles]   = useState('true')
  const [settingsSaving,   setSettingsSaving]   = useState(false)
  const [settingsMsg,      setSettingsMsg]      = useState(null)

  useEffect(() => {
    axios.get('/api/admin/settings').then(r => { setSettings(r.data); setAppName(r.data.app_name || '') }).catch(() => {})
    axios.get('/api/admin/logo').then(r => setLogoUrl(r.data.logo_url)).catch(() => {})
    axios.get('/api/config/privacy_text').then(r => setPrivacyText(r.data.value || '')).catch(() => {})
    axios.get('/api/config/imprint_text').then(r => setImprintText(r.data.value || '')).catch(() => {})
    axios.get('/api/config/company').then(r => setCompany(r.data)).catch(() => {})
    axios.get('/api/config/dashboard').then(r => {
      setTicketVisibility(r.data.ticket_visibility || 'own_and_unassigned')
      setShowGroupTiles(r.data.show_group_tiles || 'true')
    }).catch(() => {})
  }, [])

  async function handleAppNameSave() {
    setAppNameSaving(true)
    try {
      await axios.patch('/api/config/app_name', { value: appName })
      setAppNameMsg({ type: 'success', text: 'App-Name gespeichert ✓' })
    } catch {
      setAppNameMsg({ type: 'error', text: 'Fehler beim Speichern.' })
    } finally {
      setAppNameSaving(false)
      setTimeout(() => setAppNameMsg(null), 3000)
    }
  }

  async function handleCompanySave() {
    setCompanySaving(true)
    try {
      await Promise.all(Object.entries(company).map(([key, value]) =>
        axios.patch(`/api/config/${key}`, { value })
      ))
      setCompanyMsg({ type: 'success', text: 'Betreiber-Daten gespeichert ✓' })
    } catch {
      setCompanyMsg({ type: 'error', text: 'Fehler beim Speichern.' })
    } finally {
      setCompanySaving(false)
      setTimeout(() => setCompanyMsg(null), 3000)
    }
  }

  async function handleSettingsSave() {
    setSettingsSaving(true)
    try {
      await Promise.all([
        axios.patch('/api/config/ticket_visibility', { value: ticketVisibility }),
        axios.patch('/api/config/show_group_tiles',  { value: showGroupTiles }),
      ])
      setSettingsMsg({ type: 'success', text: 'Einstellungen gespeichert ✓' })
    } catch {
      setSettingsMsg({ type: 'error', text: 'Fehler beim Speichern.' })
    } finally {
      setSettingsSaving(false)
      setTimeout(() => setSettingsMsg(null), 3000)
    }
  }
  async function handleTextSave(key, value) {
    setTextSaving(key)
    try {
      await axios.patch(`/api/config/${key}`, { value })
      setTextMsg({ type: 'success', text: 'Gespeichert ✓' })
    } catch {
      setTextMsg({ type: 'error', text: 'Fehler beim Speichern.' })
    } finally {
      setTextSaving(null)
      setTimeout(() => setTextMsg(null), 3000)
    }
  }
  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post('/api/admin/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setLogoUrl(res.data.logo_url)
      invalidateLogoCache()
      setLogoMsg({ type: 'success', text: 'Logo erfolgreich hochgeladen.' })
    } catch (err) {
      setLogoMsg({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Hochladen.' })
    }
    setTimeout(() => setLogoMsg(null), 3000)
  }

  if (!settings) return <div className="admin-loading">Lade Einstellungen…</div>

  const rows = [
    { key: 'system_app_name',  val: settings.app_name },
    { key: 'system_app_url',   val: settings.app_url },
    { key: 'system_app_env',   val: settings.app_env },
    { key: 'system_smtp_host', val: settings.smtp_host },
    { key: 'system_smtp_port', val: settings.smtp_port },
    { key: 'system_smtp_user', val: settings.smtp_user },
    { key: 'system_smtp_from', val: settings.smtp_from },
    { key: 'system_imap_host', val: settings.imap_host },
    { key: 'system_imap_port', val: settings.imap_port },
    { key: 'system_imap_user', val: settings.imap_user },
  ]

  return (
    <div className="admin-system">

      {/* ── 1. Logo-Upload ── */}
      <div className="admin-logo-section glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>System-Logo</h3>
        <div className="admin-logo-preview">
          {logoUrl
            ? <img src={`${logoUrl}?t=${Date.now()}`} alt="Logo" className="admin-logo-img" />
            : <div className="admin-logo-placeholder">ZE</div>
          }
        </div>
        <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp,image/svg+xml"
          style={{ display: 'none' }} onChange={handleLogoUpload} />
        <button className="admin-btn-primary" onClick={() => fileRef.current?.click()}>
          Logo hochladen
        </button>
        <p className="admin-avatar-hint">JPEG, PNG, WebP oder SVG · max. 2MB</p>
        {logoMsg && <p className={`profile-msg profile-msg--${logoMsg.type}`}>{logoMsg.text}</p>}
      </div>

      {/* ── 2. Betreiber-Daten ── */}
      <div className="admin-text-editor glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>Betreiber-Daten</h3>
        <p className="admin-avatar-hint" style={{marginBottom:'0.75rem'}}>
          Diese Daten können als Variablen in Datenschutzerklärung und Impressum verwendet werden:<br/>
          <code style={{fontSize:'0.8rem'}}>{'{{company_name}}'}</code> · <code style={{fontSize:'0.8rem'}}>{'{{company_street}}'}</code> · <code style={{fontSize:'0.8rem'}}>{'{{company_zip}}'}</code> · <code style={{fontSize:'0.8rem'}}>{'{{company_email}}'}</code> · <code style={{fontSize:'0.8rem'}}>{'{{company_phone}}'}</code> · <code style={{fontSize:'0.8rem'}}>{'{{company_owner}}'}</code>
        </p>
        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>Firmenname / Name</label>
            <input className="admin-filter-input" value={company.company_name}
              onChange={e => setCompany(c => ({...c, company_name: e.target.value}))} placeholder="Z-Evolutions" />
          </div>
          <div className="admin-email-field">
            <label>Inhaber / Verantwortlicher</label>
            <input className="admin-filter-input" value={company.company_owner}
              onChange={e => setCompany(c => ({...c, company_owner: e.target.value}))} placeholder="Max Mustermann" />
          </div>
          <div className="admin-email-field">
            <label>Straße + Hausnummer</label>
            <input className="admin-filter-input" value={company.company_street}
              onChange={e => setCompany(c => ({...c, company_street: e.target.value}))} placeholder="Musterstraße 1" />
          </div>
          <div className="admin-email-field">
            <label>PLZ + Ort</label>
            <input className="admin-filter-input" value={company.company_zip}
              onChange={e => setCompany(c => ({...c, company_zip: e.target.value}))} placeholder="12345 Musterstadt" />
          </div>
          <div className="admin-email-field">
            <label>E-Mail</label>
            <input className="admin-filter-input" value={company.company_email}
              onChange={e => setCompany(c => ({...c, company_email: e.target.value}))} placeholder="info@beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Telefon (optional)</label>
            <input className="admin-filter-input" value={company.company_phone}
              onChange={e => setCompany(c => ({...c, company_phone: e.target.value}))} placeholder="+49 123 456789" />
          </div>
        </div>
        <div className="admin-text-footer" style={{marginTop:'1rem'}}>
          {companyMsg && <span className={`profile-msg profile-msg--${companyMsg.type}`}>{companyMsg.text}</span>}
          <button className="admin-btn-primary" onClick={handleCompanySave} disabled={companySaving}>
            {companySaving ? 'Speichern…' : 'Betreiber-Daten speichern'}
          </button>
        </div>
      </div>

      {/* ── 3. Ticket-Einstellungen ── */}
      <div className="admin-text-editor glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>Ticket-Einstellungen</h3>
        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>Ticket-Sichtbarkeit für Agenten</label>
            <select className="admin-filter-input" value={ticketVisibility}
              onChange={e => setTicketVisibility(e.target.value)}>
              <option value="all">Alle Tickets sehen</option>
              <option value="own_and_unassigned">Eigene + nicht zugewiesene</option>
              <option value="own_group">Nur eigene Gruppe</option>
            </select>
          </div>
        </div>
        <label className="admin-email-toggle" style={{marginTop:'1rem'}}>
          <div className={`admin-toggle ${showGroupTiles === 'true' ? 'admin-toggle--on' : ''}`}
            onClick={() => setShowGroupTiles(v => v === 'true' ? 'false' : 'true')}>
            <div className="admin-toggle__knob"/>
          </div>
          <span>Gruppen-Kacheln im Dashboard anzeigen</span>
        </label>
        <div className="admin-text-footer" style={{marginTop:'1rem'}}>
          {settingsMsg && <span className={`profile-msg profile-msg--${settingsMsg.type}`}>{settingsMsg.text}</span>}
          <button className="admin-btn-primary" onClick={handleSettingsSave} disabled={settingsSaving}>
            {settingsSaving ? 'Speichern…' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>

      {/* ── 4. App-Einstellungen ── */}
      <div className="admin-text-editor glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>App-Einstellungen</h3>
        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>App-Name</label>
            <input className="admin-filter-input" value={appName}
              onChange={e => setAppName(e.target.value)} placeholder="ZE-Ticket" />
          </div>
          <div className="admin-email-field">
            <label>App-URL</label>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
              <input className="admin-filter-input" value={settings?.app_url || ''} disabled
                style={{opacity:0.6, cursor:'not-allowed', flex:1}} />
              <span className="admin-avatar-hint" style={{whiteSpace:'nowrap', color:'#f59e0b'}}>
                ⚠ Nur per .env änderbar (SSL-kritisch)
              </span>
            </div>
          </div>
        </div>
        <div className="admin-text-footer" style={{marginTop:'1rem'}}>
          {appNameMsg && <span className={`profile-msg profile-msg--${appNameMsg.type}`}>{appNameMsg.text}</span>}
          <button className="admin-btn-primary" onClick={handleAppNameSave} disabled={appNameSaving}>
            {appNameSaving ? 'Speichern…' : 'App-Name speichern'}
          </button>
        </div>
      </div>

      {/* ── 5. Datenschutzerklärung ── */}
      <div className="admin-text-editor glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>Datenschutzerklärung</h3>
        <p className="admin-avatar-hint" style={{marginBottom:'0.75rem'}}>HTML-Format · Betreiber-Variablen werden automatisch ersetzt</p>
        <textarea className="admin-text-area" value={privacyText}
          onChange={e => setPrivacyText(e.target.value)} rows={12} spellCheck={false} />
        <div className="admin-text-footer">
          {textMsg && <span className={`profile-msg profile-msg--${textMsg.type}`}>{textMsg.text}</span>}
          <button className="admin-btn-primary"
            onClick={() => handleTextSave('privacy_text', privacyText)}
            disabled={textSaving === 'privacy_text'}>
            {textSaving === 'privacy_text' ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* ── 6. Impressum ── */}
      <div className="admin-text-editor glass">
        <h3 className="admin-section-title" style={{marginTop:0}}>Impressum</h3>
        <p className="admin-avatar-hint" style={{marginBottom:'0.75rem'}}>HTML-Format · Betreiber-Variablen werden automatisch ersetzt</p>
        <textarea className="admin-text-area" value={imprintText}
          onChange={e => setImprintText(e.target.value)} rows={10} spellCheck={false} />
        <div className="admin-text-footer">
          <button className="admin-btn-primary"
            onClick={() => handleTextSave('imprint_text', imprintText)}
            disabled={textSaving === 'imprint_text'}>
            {textSaving === 'imprint_text' ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Tab: Statistiken ───────────────────────────────────────────────────────────

const WIDGET_LABELS = {
  tickets_per_day:      'Tickets pro Tag (30 Tage)',
  tickets_by_status:    'Tickets nach Status',
  tickets_by_priority:  'Tickets nach Priorität',
  avg_resolution:       'Ø Lösungszeit',
  tickets_by_agent:     'Tickets pro Agent',
  tickets_by_group:     'Tickets pro Gruppe',
  sla_rate:             'SLA-Einhaltungsrate',
  sla_breaches:         'SLA-Verletzungen (7 Tage)',
  system_users:         'Benutzer & Kunden',
  upload_storage:       'Speicherverbrauch Uploads',
}

const STATUS_COLORS = {
  neu:            '#00d4ff',
  in_bearbeitung: '#f59e0b',
  geloest:        '#22c55e',
  geschlossen:    '#6b7280',
}

const PRIO_COLORS = {
  niedrig:  '#6b7280',
  normal:   '#00d4ff',
  hoch:     '#f59e0b',
  kritisch: '#ef4444',
}

const STATUS_LABELS = {
  neu: 'Neu', in_bearbeitung: 'In Bearbeitung',
  geloest: 'Gelöst', geschlossen: 'Geschlossen',
}

const PRIO_LABELS = {
  niedrig: 'Niedrig', normal: 'Normal',
  hoch: 'Hoch', kritisch: 'Kritisch',
}

function GaugeChart({ value }) {
  const r = 70, cx = 90, cy = 85
  const startAngle = Math.PI, endAngle = 0
  const angle = startAngle - (value / 100) * Math.PI
  const x = cx + r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)
  const color = value >= 90 ? '#22c55e' : value >= 70 ? '#f59e0b' : '#ef4444'
  const bgArc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const fgArc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`
  return (
    <svg viewBox="0 0 180 100" className="admin-gauge">
      <path d={bgArc} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round"/>
      <path d={fgArc} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"/>
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">{value}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="10">Einhaltung</text>
    </svg>
  )
}

function TabStatistics({ t }) {
  const [data, setData]         = useState(null)
  const [stats, setStats]       = useState(null)
  const [widgets, setWidgets]   = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ze_widgets') || 'null')
      if (saved) return saved
    } catch {}
    return Object.fromEntries(Object.keys(WIDGET_LABELS).map(k => [k, true]))
  })
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/charts').then(r => setData(r.data)).catch(() => {})
    axios.get('/api/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  function toggleWidget(key) {
    setWidgets(w => {
      const next = { ...w, [key]: !w[key] }
      localStorage.setItem('ze_widgets', JSON.stringify(next))
      return next
    })
  }

  if (!data || !stats) return <div className="admin-loading">Lade Statistiken…</div>

  const activeWidgets = Object.keys(WIDGET_LABELS).filter(k => widgets[k])

  return (
    <div className="admin-stats-tab">

      {/* ── Toolbar ── */}
      <div className="admin-toolbar" style={{marginBottom:'1rem'}}>
        <span className="admin-section-title" style={{margin:0}}>Dashboard-Statistiken</span>
        <button className="admin-btn-secondary" onClick={() => setConfigOpen(o => !o)}>
          {configOpen ? 'Fertig' : '⚙ Widgets anpassen'}
        </button>
      </div>

      {/* ── Widget-Auswahl ── */}
      {configOpen && (
        <div className="admin-widget-config glass">
          <h4 className="admin-tpl-vars-title" style={{marginBottom:'0.75rem'}}>Angezeigte Widgets</h4>
          <div className="admin-widget-config-grid">
            {Object.entries(WIDGET_LABELS).map(([key, label]) => (
              <label key={key} className="admin-widget-toggle">
                <div
                  className={`admin-toggle ${widgets[key] ? 'admin-toggle--on' : ''}`}
                  onClick={() => toggleWidget(key)}
                ><div className="admin-toggle__knob"/></div>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Widgets ── */}
      <div className="admin-widgets-grid">

        {/* Tickets pro Tag */}
        {widgets.tickets_per_day && (
          <div className="admin-widget glass admin-widget--wide">
            <h4 className="admin-widget-title">Tickets pro Tag (letzte 30 Tage)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.tickets_per_day}>
                <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d => d.slice(5)} stroke="#4a6080"/>
                <YAxis tick={{fontSize:10}} stroke="#4a6080" allowDecimals={false}/>
                <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                <Line type="monotone" dataKey="tickets" stroke="#00d4ff" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tickets nach Status */}
        {widgets.tickets_by_status && (
          <div className="admin-widget glass">
            <h4 className="admin-widget-title">Tickets nach Status</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.tickets_by_status.map(d => ({...d, name: STATUS_LABELS[d.status] || d.status}))}
                  dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                  {data.tickets_by_status.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS[d.status] || '#6b7280'}/>
                  ))}
                </Pie>
                <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                <Legend iconSize={10} wrapperStyle={{fontSize:'11px'}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tickets nach Priorität */}
        {widgets.tickets_by_priority && (
          <div className="admin-widget glass">
            <h4 className="admin-widget-title">Tickets nach Priorität</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.tickets_by_priority.map(d => ({...d, name: PRIO_LABELS[d.priority] || d.priority}))}>
                <XAxis dataKey="name" tick={{fontSize:10}} stroke="#4a6080"/>
                <YAxis tick={{fontSize:10}} stroke="#4a6080" allowDecimals={false}/>
                <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {data.tickets_by_priority.map((d, i) => (
                    <Cell key={i} fill={PRIO_COLORS[d.priority] || '#00d4ff'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ø Lösungszeit */}
        {widgets.avg_resolution && (
          <div className="admin-widget glass admin-widget--small">
            <h4 className="admin-widget-title">Ø Lösungszeit</h4>
            <div className="admin-widget-big-number" style={{color:'#00d4ff'}}>
              {data.avg_resolution_hours > 0
                ? data.avg_resolution_hours >= 24
                  ? `${Math.round(data.avg_resolution_hours / 24)}d`
                  : `${data.avg_resolution_hours}h`
                : '–'
              }
            </div>
            <p className="admin-avatar-hint" style={{textAlign:'center'}}>
              {data.avg_resolution_hours > 0 ? 'Durchschnitt (gelöste Tickets)' : 'Noch keine gelösten Tickets'}
            </p>
          </div>
        )}

        {/* Tickets pro Agent */}
        {widgets.tickets_by_agent && (
          <div className="admin-widget glass admin-widget--wide">
            <h4 className="admin-widget-title">Tickets pro Agent</h4>
            {data.tickets_by_agent.length === 0
              ? <p className="admin-empty">Keine zugewiesenen Tickets</p>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.tickets_by_agent} layout="vertical">
                    <XAxis type="number" tick={{fontSize:10}} stroke="#4a6080" allowDecimals={false}/>
                    <YAxis type="category" dataKey="agent" tick={{fontSize:10}} stroke="#4a6080" width={90}/>
                    <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                    <Bar dataKey="count" fill="#00d4ff" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        )}

        {/* Tickets pro Gruppe */}
        {widgets.tickets_by_group && (
          <div className="admin-widget glass">
            <h4 className="admin-widget-title">Tickets pro Gruppe</h4>
            {data.tickets_by_group.length === 0
              ? <p className="admin-empty">Keine zugewiesenen Tickets</p>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.tickets_by_group}>
                    <XAxis dataKey="group" tick={{fontSize:10}} stroke="#4a6080"/>
                    <YAxis tick={{fontSize:10}} stroke="#4a6080" allowDecimals={false}/>
                    <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                    <Bar dataKey="count" fill="#a78bfa" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        )}

        {/* SLA-Rate */}
        {widgets.sla_rate && (
          <div className="admin-widget glass admin-widget--small">
            <h4 className="admin-widget-title">SLA-Einhaltungsrate</h4>
            <GaugeChart value={data.sla_rate}/>
          </div>
        )}

        {/* SLA-Verletzungen */}
        {widgets.sla_breaches && (
          <div className="admin-widget glass">
            <h4 className="admin-widget-title">SLA-Verletzungen (7 Tage)</h4>
            {data.sla_breaches_per_day.length === 0
              ? <div className="admin-widget-big-number" style={{color:'#22c55e'}}>0 ✓</div>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.sla_breaches_per_day}>
                    <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d => d.slice(5)} stroke="#4a6080"/>
                    <YAxis tick={{fontSize:10}} stroke="#4a6080" allowDecimals={false}/>
                    <Tooltip contentStyle={{background:'#0d1b3e',border:'1px solid #00d4ff33',borderRadius:'6px',fontSize:'12px'}}/>
                    <Bar dataKey="violations" fill="#ef4444" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        )}

        {/* Benutzer & Kunden */}
        {widgets.system_users && (
          <div className="admin-widget glass admin-widget--small">
            <h4 className="admin-widget-title">Benutzer & Kunden</h4>
            <div className="admin-widget-user-stats">
              <div>
                <div className="admin-widget-big-number" style={{color:'#00d4ff'}}>{stats.users.agents}</div>
                <div className="admin-avatar-hint">Agenten</div>
              </div>
              <div className="admin-widget-divider"/>
              <div>
                <div className="admin-widget-big-number" style={{color:'#a78bfa'}}>{stats.users.kunden}</div>
                <div className="admin-avatar-hint">Kunden</div>
              </div>
            </div>
          </div>
        )}

        {/* Speicherverbrauch */}
        {widgets.upload_storage && (
          <div className="admin-widget glass admin-widget--small">
            <h4 className="admin-widget-title">Speicherverbrauch Uploads</h4>
            <div className="admin-widget-big-number" style={{color: data.upload_mb > 500 ? '#f59e0b' : '#22c55e'}}>
              {data.upload_mb} MB
            </div>
            <p className="admin-avatar-hint" style={{textAlign:'center'}}>Anhänge & Avatare</p>
          </div>
        )}

        {activeWidgets.length === 0 && (
          <div className="admin-empty glass" style={{padding:'2rem',gridColumn:'1/-1',textAlign:'center'}}>
            Keine Widgets aktiv — klicke auf "Widgets anpassen" um welche einzublenden.
          </div>
        )}

      </div>
    </div>
  )
}

// ── Tab: Templates ─────────────────────────────────────────────────────────────
const VAR_DESCRIPTIONS = {
  app_name:            'Name der Anwendung (z.B. ZE-Ticket)',
  app_url:             'URL des Systems (z.B. https://support.z-evolutions.de)',
  display_name:        'Anzeigename des Empfängers',
  to_name:             'Name des Empfängers (Kunde)',
  role:                'Rolle des neuen Benutzers (z.B. Agent)',
  onboarding_password: 'Temporäres Einmalpasswort für den ersten Login',
  login_url:           'Direktlink zur Login-Seite',
  reset_url:           'Direktlink zum Passwort-Reset-Formular',
  expires_minutes:     'Gültigkeitsdauer des Reset-Links in Minuten',
  ticket_number:       'Ticket-Nummer (z.B. ZE-2026-0042)',
  ticket_subject:      'Betreff / Titel des Tickets',
  agent_name:          'Anzeigename des antwortenden Agenten',
  comment_body:        'Inhalt der Agenten-Antwort',
  due_at:              'Fälligkeitsdatum der SLA (formatiert)',
}

const TEMPLATE_META = {
  tpl_invitation: {
    label: 'Einladungsmail',
    vars: ['app_name','display_name','role','onboarding_password','login_url'],
  },
  tpl_password_reset: {
    label: 'Passwort-Reset',
    vars: ['app_name','display_name','reset_url','expires_minutes'],
  },
  tpl_ticket_confirmation: {
    label: 'Ticket-Bestätigung',
    vars: ['app_name','app_url','to_name','ticket_number','ticket_subject'],
  },
  tpl_comment_notification: {
    label: 'Neue Antwort (Agent)',
    vars: ['app_name','app_url','to_name','ticket_number','ticket_subject','agent_name','comment_body'],
  },
  tpl_sla_breach: {
    label: 'SLA-Eskalation',
    vars: ['app_name','app_url','display_name','ticket_number','ticket_subject','due_at'],
  },
}

function TabTemplates({ t }) {
  const [templates, setTemplates]   = useState({})
  const [active, setActive]         = useState('tpl_invitation')
  const [code, setCode]             = useState('')
  const [preview, setPreview]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [msg, setMsg]               = useState(null)
  const textareaRef                 = useRef(null)

  useEffect(() => {
    axios.get('/api/admin/templates').then(r => {
      setTemplates(r.data)
      setCode(r.data[active] || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setCode(templates[active] || '')
    setPreview(false)
    setMsg(null)
  }, [active])

  function insertVar(varName) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const ins   = `{{${varName}}}`
    const next  = code.slice(0, start) + ins + code.slice(end)
    setCode(next)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + ins.length
      ta.focus()
    }, 0)
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await axios.patch(`/api/admin/templates/${active}`, { value: code })
      setTemplates(t => ({ ...t, [active]: code }))
      setMsg({ type: 'success', text: 'Template gespeichert ✓' })
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Fehler beim Speichern.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  async function handleReset() {
    if (!confirm('Template auf Standard zurücksetzen? Alle Änderungen gehen verloren.')) return
    setResetting(true)
    try {
      await axios.post(`/api/admin/templates/${active}/reset`)
      const r = await axios.get('/api/admin/templates')
      setTemplates(r.data)
      setCode(r.data[active] || '')
      setMsg({ type: 'success', text: 'Template zurückgesetzt ✓' })
    } catch (e) {
      setMsg({ type: 'error', text: 'Fehler beim Zurücksetzen.' })
    } finally {
      setResetting(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  const meta = TEMPLATE_META[active] || { label: active, vars: [] }

  return (
    <div className="admin-tpl">

      {/* ── Template-Auswahl ── */}
      <div className="admin-tpl-tabs glass">
        {Object.entries(TEMPLATE_META).map(([key, m]) => (
          <button
            key={key}
            className={`admin-tpl-tab ${active === key ? 'admin-tpl-tab--active' : ''}`}
            onClick={() => setActive(key)}
          >{m.label}</button>
        ))}
      </div>

      <div className="admin-tpl-body">

        {/* ── Variablen-Helfer ── */}
        <div className="admin-tpl-vars glass">
          <h4 className="admin-tpl-vars-title">Verfügbare Variablen</h4>
          <p className="admin-avatar-hint" style={{marginBottom:'0.75rem'}}>
            Klicken um an Cursor-Position einzufügen
          </p>
          <div className="admin-tpl-vars-list">
            {meta.vars.map(v => (
              <div key={v} className="admin-tpl-var-item">
                <button className="admin-tpl-var-btn" onClick={() => insertVar(v)}>
                  {`{{${v}}}`}
                </button>
                {VAR_DESCRIPTIONS[v] && (
                  <div className="admin-tpl-var-tooltip-wrap">
                    <span className="admin-tpl-var-hint">?</span>
                    <div className="admin-tpl-var-tooltip">{VAR_DESCRIPTIONS[v]}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Editor / Vorschau ── */}
        <div className="admin-tpl-editor glass">
          <div className="admin-tpl-editor-header">
            <span className="admin-tpl-editor-title">{meta.label}</span>
            <div className="admin-tpl-editor-actions">
              <button
                className={`admin-btn-secondary ${preview ? 'admin-btn-secondary--active' : ''}`}
                onClick={() => setPreview(p => !p)}
              >{preview ? 'HTML-Editor' : 'Vorschau'}</button>
            </div>
          </div>

          {preview ? (
            <iframe
              className="admin-tpl-preview"
              srcDoc={code}
              title="Template-Vorschau"
              sandbox="allow-same-origin"
            />
          ) : (
            <textarea
              ref={textareaRef}
              className="admin-tpl-textarea"
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
            />
          )}

          <div className="admin-tpl-footer">
            <div className="admin-tpl-footer-left">
              {msg && <span className={`admin-email-msg admin-email-msg--${msg.type}`}>{msg.text}</span>}
            </div>
            <div className="admin-tpl-footer-right">
              <button className="admin-btn-secondary" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Zurücksetzen…' : 'Standard wiederherstellen'}
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichern…' : 'Template speichern'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Tab: Backup ────────────────────────────────────────────────────────────────
function TabBackup({ t }) {
  const EMPTY = {
    enabled: 'false', target: 'local', schedule_hour: '2',
    retention_days: '30', retention_min: '7', include_uploads: 'true',
    local_path: '/app/backups',
    webdav_url: '', webdav_user: '', webdav_password: '', webdav_path: '/backups',
    sftp_host: '', sftp_port: '22', sftp_user: '', sftp_password: '', sftp_path: '/backups',
    s3_endpoint: '', s3_bucket: '', s3_region: 'auto', s3_access_key: '', s3_secret_key: '', s3_path: 'backups',
  }
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [running, setRunning] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [runResult, setRunResult] = useState(null)
  const [restoreFile, setRestoreFile]       = useState(null)
  const [restoreDb, setRestoreDb]           = useState(true)
  const [restoreUploads, setRestoreUploads] = useState(true)
  const [restoring, setRestoring]           = useState(false)
  const [restoreResult, setRestoreResult]   = useState(null)

  useEffect(() => {
    axios.get('/api/admin/backup-config').then(r => {
      const d = r.data
      setForm({
        enabled:         d.general.enabled,
        target:          d.general.target,
        schedule_hour:   d.general.schedule_hour,
        retention_days:  d.general.retention_days,
        retention_min:   d.general.retention_min,
        include_uploads: d.general.include_uploads,
        local_path:      d.local.path,
        webdav_url:      d.webdav.url,
        webdav_user:     d.webdav.user,
        webdav_password: '',
        webdav_path:     d.webdav.path,
        sftp_host:       d.sftp.host,
        sftp_port:       d.sftp.port,
        sftp_user:       d.sftp.user,
        sftp_password:   '',
        sftp_path:       d.sftp.path,
        s3_endpoint:     d.s3.endpoint,
        s3_bucket:       d.s3.bucket,
        s3_region:       d.s3.region,
        s3_access_key:   d.s3.access_key,
        s3_secret_key:   '',
        s3_path:         d.s3.path,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 5000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.webdav_password) delete payload.webdav_password
      if (!payload.sftp_password)   delete payload.sftp_password
      if (!payload.s3_secret_key)   delete payload.s3_secret_key
      await axios.patch('/api/admin/backup-config', payload)
      showMsg('success', 'Konfiguration gespeichert ✓')
    } catch (e) {
      showMsg('error', e.response?.data?.detail || 'Fehler beim Speichern.')
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const r = await axios.post('/api/admin/backup/test')
      showMsg('success', r.data.detail)
    } catch (e) {
      showMsg('error', e.response?.data?.detail || 'Verbindungstest fehlgeschlagen.')
    } finally { setTesting(false) }
  }

  async function handleRunNow() {
    setRunning(true)
    setRunResult(null)
    try {
      const r = await axios.post('/api/admin/backup/run')
      setRunResult({ type: 'success', data: r.data })
    } catch (e) {
      setRunResult({ type: 'error', data: { error: e.response?.data?.detail || 'Backup fehlgeschlagen.' } })
    } finally { setRunning(false) }
  }

  async function handleRestore() {
    if (!restoreFile) return
    if (!confirm('⚠️ Achtung! Bestehende Daten werden überschrieben. Wirklich fortfahren?')) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      formData.append('restore_db', restoreDb ? 'true' : 'false')
      formData.append('restore_uploads', restoreUploads ? 'true' : 'false')
      const r = await axios.post('/api/admin/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setRestoreResult({ type: 'success', data: r.data })
    } catch (e) {
      setRestoreResult({ type: 'error', data: { error: e.response?.data?.detail || 'Fehler beim Wiederherstellen.' } })
    } finally { setRestoring(false) }
  }

  async function handleRestore() {
    if (!restoreFile) return
    if (!confirm('⚠️ Achtung! Bestehende Daten werden überschrieben. Wirklich fortfahren?')) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      formData.append('restore_db', restoreDb ? 'true' : 'false')
      formData.append('restore_uploads', restoreUploads ? 'true' : 'false')
      const r = await axios.post('/api/admin/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setRestoreResult({ type: 'success', data: r.data })
    } catch (e) {
      setRestoreResult({ type: 'error', data: { error: e.response?.data?.detail || 'Fehler beim Wiederherstellen.' } })
    } finally { setRestoring(false) }
  }

  if (loading) return <div className="admin-loading">Lade Backup-Konfiguration…</div>

  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="admin-email">

      {/* ── Allgemein ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>Allgemein</h3>
        <label className="admin-email-toggle" style={{marginBottom:'1rem'}}>
          <div className={`admin-toggle ${form.enabled === 'true' ? 'admin-toggle--on' : ''}`}
            onClick={() => set('enabled', form.enabled === 'true' ? 'false' : 'true')}>
            <div className="admin-toggle__knob"/>
          </div>
          <span>Automatisches Backup {form.enabled === 'true' ? 'aktiviert' : 'deaktiviert'}</span>
        </label>

        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>Backup-Ziel</label>
            <select className="admin-filter-input" value={form.target}
              onChange={e => set('target', e.target.value)}>
              <option value="local">Lokal (auf dem Server)</option>
              <option value="webdav">WebDAV (Nextcloud, ownCloud, HiDrive)</option>
              <option value="sftp">SFTP (NAS, eigener Server)</option>
              <option value="s3">S3-kompatibel (Hetzner, Backblaze, AWS)</option>
            </select>
          </div>
          <div className="admin-email-field">
            <label>Uhrzeit (UTC)</label>
            <select className="admin-filter-input" value={form.schedule_hour}
              onChange={e => set('schedule_hour', e.target.value)}>
              {HOURS.map(h => (
                <option key={h} value={String(h)}>{String(h).padStart(2,'0')}:00 Uhr</option>
              ))}
            </select>
          </div>
          <div className="admin-email-field">
            <label>Aufbewahrung (Tage)</label>
            <input className="admin-filter-input" type="number" min="1" max="365"
              value={form.retention_days} onChange={e => set('retention_days', e.target.value)}/>
          </div>
          <div className="admin-email-field">
            <label>Mindestanzahl Backups</label>
            <input className="admin-filter-input" type="number" min="1" max="100"
              value={form.retention_min} onChange={e => set('retention_min', e.target.value)}/>
          </div>
        </div>

        <label className="admin-email-toggle" style={{marginTop:'0.75rem'}}>
          <div className={`admin-toggle ${form.include_uploads === 'true' ? 'admin-toggle--on' : ''}`}
            onClick={() => set('include_uploads', form.include_uploads === 'true' ? 'false' : 'true')}>
            <div className="admin-toggle__knob"/>
          </div>
          <span>Uploads (Anhänge & Avatare) einschließen</span>
        </label>
      </div>

      {/* ── Ziel-spezifische Einstellungen ── */}
      {form.target === 'local' && (
        <div className="admin-email-section glass">
          <h3 className="admin-section-title" style={{ marginTop: 0 }}>Lokaler Speicherpfad</h3>
          <div className="admin-email-grid">
            <div className="admin-email-field" style={{gridColumn:'1/-1'}}>
              <label>Pfad auf dem Server</label>
              <input className="admin-filter-input" value={form.local_path}
                onChange={e => set('local_path', e.target.value)} placeholder="/app/backups"/>
            </div>
          </div>
        </div>
      )}

      {form.target === 'webdav' && (
        <div className="admin-email-section glass">
          <h3 className="admin-section-title" style={{ marginTop: 0 }}>WebDAV-Konfiguration</h3>
          <div className="admin-email-grid">
            <div className="admin-email-field" style={{gridColumn:'1/-1'}}>
              <label>Server-URL</label>
              <input className="admin-filter-input" value={form.webdav_url}
                onChange={e => set('webdav_url', e.target.value)}
                placeholder="https://nextcloud.beispiel.de/remote.php/dav/files/user"/>
            </div>
            <div className="admin-email-field">
              <label>Benutzername</label>
              <input className="admin-filter-input" value={form.webdav_user}
                onChange={e => set('webdav_user', e.target.value)}/>
            </div>
            <div className="admin-email-field">
              <label>Passwort <span className="admin-avatar-hint">(leer = unverändert)</span></label>
              <input className="admin-filter-input" type="password" value={form.webdav_password}
                onChange={e => set('webdav_password', e.target.value)} placeholder="••••••••"/>
            </div>
            <div className="admin-email-field">
              <label>Remote-Pfad</label>
              <input className="admin-filter-input" value={form.webdav_path}
                onChange={e => set('webdav_path', e.target.value)} placeholder="/backups"/>
            </div>
          </div>
        </div>
      )}

      {form.target === 'sftp' && (
        <div className="admin-email-section glass">
          <h3 className="admin-section-title" style={{ marginTop: 0 }}>SFTP-Konfiguration</h3>
          <div className="admin-email-grid">
            <div className="admin-email-field">
              <label>Host</label>
              <input className="admin-filter-input" value={form.sftp_host}
                onChange={e => set('sftp_host', e.target.value)} placeholder="nas.beispiel.de"/>
            </div>
            <div className="admin-email-field">
              <label>Port</label>
              <input className="admin-filter-input" value={form.sftp_port}
                onChange={e => set('sftp_port', e.target.value)} placeholder="22"/>
            </div>
            <div className="admin-email-field">
              <label>Benutzername</label>
              <input className="admin-filter-input" value={form.sftp_user}
                onChange={e => set('sftp_user', e.target.value)}/>
            </div>
            <div className="admin-email-field">
              <label>Passwort <span className="admin-avatar-hint">(leer = unverändert)</span></label>
              <input className="admin-filter-input" type="password" value={form.sftp_password}
                onChange={e => set('sftp_password', e.target.value)} placeholder="••••••••"/>
            </div>
            <div className="admin-email-field">
              <label>Remote-Pfad</label>
              <input className="admin-filter-input" value={form.sftp_path}
                onChange={e => set('sftp_path', e.target.value)} placeholder="/backups"/>
            </div>
          </div>
        </div>
      )}

      {form.target === 's3' && (
        <div className="admin-email-section glass">
          <h3 className="admin-section-title" style={{ marginTop: 0 }}>S3-Konfiguration</h3>
          <p className="admin-avatar-hint" style={{marginBottom:'0.75rem'}}>
            Kompatibel mit Hetzner Object Storage, Backblaze B2, AWS S3 und anderen S3-kompatiblen Diensten.
          </p>
          <div className="admin-email-grid">
            <div className="admin-email-field" style={{gridColumn:'1/-1'}}>
              <label>Endpoint-URL <span className="admin-avatar-hint">(leer für AWS S3)</span></label>
              <input className="admin-filter-input" value={form.s3_endpoint}
                onChange={e => set('s3_endpoint', e.target.value)}
                placeholder="https://fsn1.your-objectstorage.com"/>
            </div>
            <div className="admin-email-field">
              <label>Bucket-Name</label>
              <input className="admin-filter-input" value={form.s3_bucket}
                onChange={e => set('s3_bucket', e.target.value)} placeholder="ze-ticket-backups"/>
            </div>
            <div className="admin-email-field">
              <label>Region</label>
              <input className="admin-filter-input" value={form.s3_region}
                onChange={e => set('s3_region', e.target.value)} placeholder="auto"/>
            </div>
            <div className="admin-email-field">
              <label>Access Key</label>
              <input className="admin-filter-input" value={form.s3_access_key}
                onChange={e => set('s3_access_key', e.target.value)}/>
            </div>
            <div className="admin-email-field">
              <label>Secret Key <span className="admin-avatar-hint">(leer = unverändert)</span></label>
              <input className="admin-filter-input" type="password" value={form.s3_secret_key}
                onChange={e => set('s3_secret_key', e.target.value)} placeholder="••••••••"/>
            </div>
            <div className="admin-email-field">
              <label>Pfad / Prefix</label>
              <input className="admin-filter-input" value={form.s3_path}
                onChange={e => set('s3_path', e.target.value)} placeholder="backups"/>
            </div>
          </div>
        </div>
      )}

      {/* ── Aktionen ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>Aktionen</h3>
        <div className="admin-email-actions" style={{flexWrap:'wrap', gap:'0.75rem'}}>
          <button className="admin-btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Teste…' : '🔌 Verbindung testen'}
          </button>
          <button className="admin-btn-secondary" onClick={handleRunNow} disabled={running}>
            {running ? 'Backup läuft…' : '▶ Backup jetzt ausführen'}
          </button>
          {msg && <span className={`admin-email-msg admin-email-msg--${msg.type}`}>{msg.text}</span>}
        </div>

        {runResult && (
          <div className={`admin-backup-result admin-backup-result--${runResult.type}`}>
            {runResult.type === 'success' ? (
              <>
                <strong>✅ Backup erfolgreich</strong>
                <span>Datei: {runResult.data.filename}</span>
                <span>Größe: {runResult.data.size_mb} MB</span>
                <span>Dauer: {runResult.data.duration}s</span>
                {runResult.data.deleted > 0 && <span>{runResult.data.deleted} alte Backup(s) gelöscht</span>}
              </>
            ) : (
              <><strong>❌ Fehler:</strong> <span>{runResult.data.error}</span></>
            )}
          </div>
        )}
      </div>

      {/* ── .env Hinweis ── */}
      <div className="admin-backup-warning glass">
        <span className="admin-backup-warning-icon">⚠️</span>
        <div>
          <strong>Wichtig: Die .env-Datei ist nicht im Backup enthalten!</strong>
          <p>Die .env-Datei enthält sensible Zugangsdaten (Datenbankpasswörter, SECRET_KEY) und wird aus Sicherheitsgründen nicht gesichert. Bitte bewahren Sie diese Datei separat auf — z.B. in einem Passwortmanager. Ohne die .env kann das System nach einem Totalausfall nicht wiederhergestellt werden.</p>
        </div>
      </div>

      {/* ── Restore ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>Backup wiederherstellen</h3>
        <p className="admin-avatar-hint" style={{marginBottom:'1rem'}}>
          Nur Superadmins können Backups einspielen. Bestehende Daten werden überschrieben.
        </p>
        <div className="admin-email-grid">
          <div className="admin-email-field" style={{gridColumn:'1/-1'}}>
            <label>Backup-Datei (.tar.gz)</label>
            <input type="file" accept=".tar.gz"
              className="admin-filter-input"
              onChange={e => setRestoreFile(e.target.files[0])}/>
          </div>
        </div>
        <div style={{display:'flex', gap:'1.5rem', marginTop:'0.75rem'}}>
          <label className="admin-email-toggle">
            <div className={`admin-toggle ${restoreDb ? 'admin-toggle--on' : ''}`}
              onClick={() => setRestoreDb(v => !v)}>
              <div className="admin-toggle__knob"/>
            </div>
            <span>Datenbank wiederherstellen</span>
          </label>
          <label className="admin-email-toggle">
            <div className={`admin-toggle ${restoreUploads ? 'admin-toggle--on' : ''}`}
              onClick={() => setRestoreUploads(v => !v)}>
              <div className="admin-toggle__knob"/>
            </div>
            <span>Uploads wiederherstellen</span>
          </label>
        </div>
        <div className="admin-email-actions" style={{marginTop:'1rem'}}>
          <button className="admin-btn-danger"
            onClick={handleRestore}
            disabled={restoring || !restoreFile}>
            {restoring ? 'Wird wiederhergestellt…' : '⚠ Backup einspielen'}
          </button>
          {restoreResult && (
            <div className={`admin-backup-result admin-backup-result--${restoreResult.type}`}>
              {restoreResult.type === 'success' ? (
                <>
                  <strong>✅ Wiederherstellung erfolgreich</strong>
                  {Object.entries(restoreResult.data.results || {}).map(([k,v]) => (
                    <span key={k}>{k}: {v}</span>
                  ))}
                  <span>Dauer: {restoreResult.data.duration}s</span>
                </>
              ) : (
                <><strong>❌ Fehler:</strong> <span>{restoreResult.data.error}</span></>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── .env Hinweis ── */}


      {/* ── Speichern ── */}
      <div className="admin-email-save">
        {msg && <span className={`profile-msg profile-msg--${msg.type}`}>{msg.text}</span>}
        <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Speichern…' : 'Konfiguration speichern'}
        </button>
      </div>

    </div>
  )
}

// ── Tab: E-Mail ────────────────────────────────────────────────────────────────
function TabEmail({ t }) {
  const EMPTY = {
    smtp_host: '', smtp_port: '465', smtp_user: '', smtp_password: '',
    smtp_from: '', smtp_from_name: '', smtp_ssl: 'true',
    imap_host: '', imap_port: '993', imap_user: '', imap_password: '',
    imap_ssl: 'true', imap_enabled: 'true',
  }
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)
  const [testSmtp, setTestSmtp] = useState(null)
  const [testImap, setTestImap] = useState(null)
  const [testing, setTesting]   = useState({ smtp: false, imap: false })

  useEffect(() => {
    axios.get('/api/admin/mail-config').then(r => {
      const d = r.data
      setForm({
        smtp_host:      d.smtp.host,
        smtp_port:      d.smtp.port,
        smtp_user:      d.smtp.user,
        smtp_password:  '',
        smtp_from:      d.smtp.from_email,
        smtp_from_name: d.smtp.from_name,
        smtp_ssl:       d.smtp.ssl,
        imap_host:      d.imap.host,
        imap_port:      d.imap.port,
        imap_user:      d.imap.user,
        imap_password:  '',
        imap_ssl:       d.imap.ssl,
        imap_enabled:   d.imap.enabled,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const payload = { ...form }
      if (!payload.smtp_password) delete payload.smtp_password
      if (!payload.imap_password) delete payload.imap_password
      await axios.patch('/api/admin/mail-config', payload)
      setMsg({ type: 'success', text: 'Konfiguration gespeichert ✓' })
      setForm(f => ({ ...f, smtp_password: '', imap_password: '' }))
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Fehler beim Speichern.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  async function handleTestSmtp() {
    setTesting(t => ({ ...t, smtp: true }))
    setTestSmtp(null)
    try {
      const r = await axios.post('/api/admin/mail-config/test-smtp')
      setTestSmtp({ type: 'success', text: r.data.detail })
    } catch (e) {
      setTestSmtp({ type: 'error', text: e.response?.data?.detail || 'SMTP-Test fehlgeschlagen.' })
    } finally {
      setTesting(t => ({ ...t, smtp: false }))
    }
  }

  async function handleTestImap() {
    setTesting(t => ({ ...t, imap: true }))
    setTestImap(null)
    try {
      const r = await axios.post('/api/admin/mail-config/test-imap')
      setTestImap({ type: 'success', text: r.data.detail })
    } catch (e) {
      setTestImap({ type: 'error', text: e.response?.data?.detail || 'IMAP-Test fehlgeschlagen.' })
    } finally {
      setTesting(t => ({ ...t, imap: false }))
    }
  }

  if (loading) return <div className="admin-loading">Lade Mail-Konfiguration…</div>

  return (
    <div className="admin-email">

      {/* ── IMAP-Schalter ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>Ticket-Eingang per E-Mail</h3>
        <p className="admin-avatar-hint">
          Wenn aktiviert, werden eingehende E-Mails automatisch als Tickets angelegt (IMAP-Polling alle 60s).
        </p>
        <label className="admin-email-toggle">
          <div
            className={`admin-toggle ${form.imap_enabled === 'true' ? 'admin-toggle--on' : ''}`}
            onClick={() => set('imap_enabled', form.imap_enabled === 'true' ? 'false' : 'true')}
          >
            <div className="admin-toggle__knob" />
          </div>
          <span>{form.imap_enabled === 'true' ? 'Aktiviert' : 'Deaktiviert'}</span>
        </label>
      </div>

      {/* ── SMTP ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>SMTP — Ausgehende E-Mails</h3>
        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>Server (Host)</label>
            <input className="admin-filter-input" value={form.smtp_host}
              onChange={e => set('smtp_host', e.target.value)} placeholder="mail.beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Port</label>
            <input className="admin-filter-input" value={form.smtp_port}
              onChange={e => set('smtp_port', e.target.value)} placeholder="465" />
          </div>
          <div className="admin-email-field">
            <label>Benutzername</label>
            <input className="admin-filter-input" value={form.smtp_user}
              onChange={e => set('smtp_user', e.target.value)} placeholder="user@beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Passwort <span className="admin-avatar-hint">(leer lassen = unverändert)</span></label>
            <input className="admin-filter-input" type="password" value={form.smtp_password}
              onChange={e => set('smtp_password', e.target.value)} placeholder="••••••••" />
          </div>
          <div className="admin-email-field">
            <label>Absender-Adresse</label>
            <input className="admin-filter-input" value={form.smtp_from}
              onChange={e => set('smtp_from', e.target.value)} placeholder="support@beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Absender-Name</label>
            <input className="admin-filter-input" value={form.smtp_from_name}
              onChange={e => set('smtp_from_name', e.target.value)} placeholder="Mein Support" />
          </div>
          <div className="admin-email-field">
            <label>Verschlüsselung</label>
            <select className="admin-filter-input" value={form.smtp_ssl}
              onChange={e => set('smtp_ssl', e.target.value)}>
              <option value="true">SSL (Port 465)</option>
              <option value="false">STARTTLS (Port 587)</option>
            </select>
          </div>
        </div>
        <div className="admin-email-actions">
          <button className="admin-btn-secondary" onClick={handleTestSmtp} disabled={testing.smtp}>
            {testing.smtp ? 'Teste…' : 'Verbindung testen'}
          </button>
          {testSmtp && <span className={`admin-email-msg admin-email-msg--${testSmtp.type}`}>{testSmtp.text}</span>}
        </div>
      </div>

      {/* ── IMAP ── */}
      <div className="admin-email-section glass">
        <h3 className="admin-section-title" style={{ marginTop: 0 }}>IMAP — Eingehende E-Mails</h3>
        <div className="admin-email-grid">
          <div className="admin-email-field">
            <label>Server (Host)</label>
            <input className="admin-filter-input" value={form.imap_host}
              onChange={e => set('imap_host', e.target.value)} placeholder="mail.beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Port</label>
            <input className="admin-filter-input" value={form.imap_port}
              onChange={e => set('imap_port', e.target.value)} placeholder="993" />
          </div>
          <div className="admin-email-field">
            <label>Benutzername</label>
            <input className="admin-filter-input" value={form.imap_user}
              onChange={e => set('imap_user', e.target.value)} placeholder="user@beispiel.de" />
          </div>
          <div className="admin-email-field">
            <label>Passwort <span className="admin-avatar-hint">(leer lassen = unverändert)</span></label>
            <input className="admin-filter-input" type="password" value={form.imap_password}
              onChange={e => set('imap_password', e.target.value)} placeholder="••••••••" />
          </div>
          <div className="admin-email-field">
            <label>Verschlüsselung</label>
            <select className="admin-filter-input" value={form.imap_ssl}
              onChange={e => set('imap_ssl', e.target.value)}>
              <option value="true">SSL (Port 993)</option>
              <option value="false">STARTTLS (Port 143)</option>
            </select>
          </div>
        </div>
        <div className="admin-email-actions">
          <button className="admin-btn-secondary" onClick={handleTestImap} disabled={testing.imap}>
            {testing.imap ? 'Teste…' : 'Verbindung testen'}
          </button>
          {testImap && <span className={`admin-email-msg admin-email-msg--${testImap.type}`}>{testImap.text}</span>}
        </div>
      </div>

      {/* ── Speichern ── */}
      <div className="admin-email-save">
        {msg && <span className={`profile-msg profile-msg--${msg.type}`}>{msg.text}</span>}
        <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Speichern…' : 'Konfiguration speichern'}
        </button>
      </div>

    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────
const TABS = ['overview', 'users', 'groups', 'sla', 'audit', 'system', 'email', 'templates', 'statistics', 'backup']

export default function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  // Nur Admins und Superadmins
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-page">
        <NavBar />
        <main className="admin-main">
          <p>Kein Zugriff.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <NavBar />
      <main className="admin-main">
        <h1 className="admin-title">{t('admin.title')}</h1>

        <div className="admin-tabs glass">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`admin.tab_${tab}`)}
            </button>
          ))}
        </div>

        <div className="admin-tab-content">
          {activeTab === 'overview' && <TabOverview t={t} />}
          {activeTab === 'users'    && <div className="admin-embedded"><UsersPage embedded /></div>}
          {activeTab === 'groups'   && <div className="admin-embedded"><GroupsPage embedded /></div>}
          {activeTab === 'sla'      && <TabSLA t={t} />}
          {activeTab === 'audit'    && <TabAudit t={t} />}
          {activeTab === 'system'   && <TabSystem t={t} />}
          {activeTab === 'email'    && <TabEmail t={t} />}
          {activeTab === 'templates' && <TabTemplates t={t} />}
          {activeTab === 'statistics' && <TabStatistics t={t} />}
          {activeTab === 'backup'     && <TabBackup t={t} />}
        </div>
      </main>
    </div>
  )
}
