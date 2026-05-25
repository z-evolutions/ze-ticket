import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { fetchTicketStats, fetchTickets } from '../api/tickets'
import axios from 'axios'
import NavBar from '../components/NavBar'
import './DashboardPage.css'

function formatDate(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CLASS = {
  neu: 'db-badge--neu', in_bearbeitung: 'db-badge--progress',
  geloest: 'db-badge--done', geschlossen: 'db-badge--closed',
}
const PRIORITY_CLASS = {
  niedrig: 'db-badge--low', normal: 'db-badge--normal',
  hoch: 'db-badge--high', kritisch: 'db-badge--critical',
}

// ── KPI-Karte (obere Leiste) ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, onClick, warn }) {
  const displayValue = value === null || value === undefined ? '–' : String(value)
  return (
    <button
      className={`db-kpi-card ${color ? `db-kpi-card--${color}` : ''} ${warn ? 'db-kpi-card--warn' : ''}`}
      onClick={onClick}
    >
      <div className="db-kpi-card__value-wrap">
        <span className="db-kpi-card__value">{displayValue}</span>
      </div>
      <div className="db-kpi-card__text-wrap">
        <span className="db-kpi-card__label">{label}</span>
        {sub && <span className="db-kpi-card__sub">{sub}</span>}
      </div>
    </button>
  )
}

// ── Gruppen-Kachel ─────────────────────────────────────────────────────────────
function GroupCard({ group, onClick, t }) {
  const hasAlert = group.sla_breached > 0 || group.critical > 0
  return (
    <button
      className={`db-group-card glass ${hasAlert ? 'db-group-card--alert' : ''}`}
      onClick={onClick}
    >
      <div className="db-group-card__header">
        <span className="db-group-card__name">{group.name}</span>
        {hasAlert && <span className="db-group-card__alert-dot" />}
      </div>
      <div className="db-group-card__stats">
        <div className="db-group-card__stat">
          <span className="db-group-card__stat-value db-group-card__stat-value--cyan">{group.open}</span>
          <span className="db-group-card__stat-label">{t('dashboard.group_open')}</span>
        </div>
        <div className="db-group-card__stat">
          <span className="db-group-card__stat-value">{group.unassigned}</span>
          <span className="db-group-card__stat-label">{t('dashboard.group_unassigned')}</span>
        </div>
        <div className="db-group-card__stat">
          <span className={`db-group-card__stat-value ${group.critical > 0 ? 'db-group-card__stat-value--critical' : ''}`}>{group.critical}</span>
          <span className="db-group-card__stat-label">{t('dashboard.group_critical')}</span>
        </div>
        <div className="db-group-card__stat">
          <span className={`db-group-card__stat-value ${group.sla_breached > 0 ? 'db-group-card__stat-value--warn' : ''}`}>{group.sla_breached}</span>
          <span className="db-group-card__stat-label">{t('dashboard.group_sla')}</span>
        </div>
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [stats,       setStats]       = useState(null)
  const [dashConfig,  setDashConfig]  = useState({ show_group_tiles: "true" })
  const [myStats,     setMyStats]     = useState(null)
  const [groupStats,  setGroupStats]  = useState([])
  const [myTickets,   setMyTickets]   = useState([])
  const [openTickets, setOpenTickets] = useState([])
  const [loading,     setLoading]     = useState(true)

  const isAgent = user?.role && ['agent', 'manager', 'admin', 'superadmin'].includes(user.role)



  useEffect(() => { loadDashboard() }, [])
  const token = localStorage.getItem('ze-token')
  const handleWsEvent = useCallback(() => { silentRefresh() }, [])


  async function silentRefresh() {
    try {
      const [statsData, myStatsData, groupStatsData, myData, openData, dashCfg] = await Promise.all([
        fetchTicketStats(),
        isAgent ? axios.get('/api/tickets/my-stats').then(r => r.data) : null,
        isAgent ? axios.get('/api/tickets/group-stats').then(r => r.data) : null,
        fetchTickets({ assignedToMe: true, pageSize: 5 }),
        fetchTickets({ status: 'neu', unassignedForMe: true, pageSize: 5 }),
        axios.get('/api/config/dashboard').then(r => r.data),
      ])
      setStats(statsData)
      if (myStatsData) setMyStats(myStatsData)
      if (groupStatsData) setGroupStats(groupStatsData)
      setMyTickets(myData.tickets)
      setOpenTickets(openData.tickets)
      if (dashCfg) setDashConfig(dashCfg)
    } catch {}
  }

  async function loadDashboard() {
    setLoading(true)
    try {
      await silentRefresh()
    } catch (e) {
      console.error('Dashboard-Ladefehler:', e)
    } finally {
      setLoading(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.greeting_morning')
    : hour < 18 ? t('dashboard.greeting_day')
    : t('dashboard.greeting_evening')

  return (
    <div className="dashboard-page">
      <NavBar />
      <main className="dashboard-main">

        {/* ── Willkommen ── */}
        <div className="db-welcome">
          <div>
            <h1 className="db-welcome__title">{greeting}, {user?.display_name || 'Agent'}!</h1>
            <p className="db-welcome__sub">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button className="db-new-ticket-btn" onClick={() => navigate('/tickets/new')}>
            {t('dashboard.new_ticket')}
          </button>
        </div>

        {loading ? (
          <div className="db-loading"><div className="db-spinner" /><span>{t('common.loading')}</span></div>
        ) : (
          <>
            {/* ── Persönliche KPI-Leiste (nur Agenten) ── */}
            {isAgent && myStats && (
              <div className="db-kpi-bar">
                <KpiCard
                  label={t('dashboard.kpi_my_open')}
                  value={myStats.my_open}
                  color="cyan"
                  onClick={() => navigate('/tickets?assigned_to_me=true')}
                />
                <KpiCard
                  label={t('dashboard.kpi_unassigned')}
                  value={myStats.unassigned}
                  sub={t('dashboard.kpi_unassigned_sub')}
                  onClick={() => navigate('/tickets?status=neu')}
                  warn={myStats.unassigned > 0}
                />
                <KpiCard
                  label={t('dashboard.kpi_critical')}
                  value={myStats.my_critical}
                  color={myStats.my_critical > 0 ? 'critical' : ''}
                  onClick={() => navigate('/tickets?priority=kritisch&assigned_to_me=true')}
                  warn={myStats.my_critical > 0}
                />
                <KpiCard
                  label={t('dashboard.kpi_resolved_today')}
                  value={myStats.resolved_today}
                  color="success"
                  onClick={() => navigate('/tickets?assigned_to_me=true')}
                />
                <KpiCard
                  label={t('dashboard.kpi_avg_time')}
                  value={myStats.avg_hours > 0
                    ? myStats.avg_hours >= 24
                      ? `${Math.round(myStats.avg_hours / 24)}d`
                      : `${myStats.avg_hours}h`
                    : '–'}
                  sub={t('dashboard.kpi_avg_time_sub')}
                />
                <KpiCard
                  label={t('dashboard.kpi_sla')}
                  value={`${myStats.sla_rate}%`}
                  color={myStats.sla_rate >= 90 ? 'success' : myStats.sla_rate >= 70 ? 'warn' : 'critical'}
                  warn={myStats.sla_rate < 90}
                />
              </div>
            )}



            {/* ── Gruppen-Kacheln ── */}
            {isAgent && groupStats.length > 0 && dashConfig.show_group_tiles === 'true' && (
              <div className="db-section">
                <h2 className="db-section-title">{t('dashboard.group_tiles_title')}</h2>
                <div className="db-group-grid">
                  {groupStats.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      t={t}
                      onClick={() => navigate(`/tickets?group_id=${group.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Ticket-Listen ── */}
            <div className="db-panels">
              {isAgent && (
                <div className="db-panel glass">
                  <div className="db-panel__header">
                    <h2 className="db-panel__title">{t('dashboard.panel_my_tickets')}</h2>
                    <button className="db-panel__link" onClick={() => navigate('/tickets?assigned_to_me=true')}>
                      {t('dashboard.panel_all')}
                    </button>
                  </div>
                  {myTickets.length === 0 ? (
                    <div className="db-panel__empty">{t('dashboard.no_assigned')}</div>
                  ) : (
                    <div className="db-ticket-list">
                      {myTickets.map(ticket => (
                        <div key={ticket.id} className="db-ticket-row" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                          <div className="db-ticket-row__left">
                            <span className="db-ticket-number">{ticket.ticket_number}</span>
                            <span className="db-ticket-subject">{ticket.subject}</span>
                          </div>
                          <div className="db-ticket-row__right">
                            <span className={`db-badge ${STATUS_CLASS[ticket.status]}`}>
                              {t(`tickets.status_${ticket.status}`)}
                            </span>
                            <span className={`db-badge ${PRIORITY_CLASS[ticket.priority]}`}>
                              {t(`tickets.priority_${ticket.priority}`)}
                            </span>
                            <span className="db-ticket-date">{formatDate(ticket.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="db-panel glass">
                <div className="db-panel__header">
                  <h2 className="db-panel__title">{t('dashboard.panel_unassigned')}</h2>
                  <button className="db-panel__link" onClick={() => navigate('/tickets?status=neu')}>
                    {t('dashboard.panel_all')}
                  </button>
                </div>
                {openTickets.length === 0 ? (
                  <div className="db-panel__empty">{t('dashboard.no_unassigned')}</div>
                ) : (
                  <div className="db-ticket-list">
                    {openTickets.map(ticket => (
                      <div key={ticket.id} className="db-ticket-row" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                        <div className="db-ticket-row__left">
                          <span className="db-ticket-number">{ticket.ticket_number}</span>
                          <span className="db-ticket-subject">{ticket.subject}</span>
                        </div>
                        <div className="db-ticket-row__right">
                          <span className={`db-badge ${PRIORITY_CLASS[ticket.priority]}`}>
                            {t(`tickets.priority_${ticket.priority}`)}
                          </span>
                          <span className="db-ticket-date">{formatDate(ticket.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
