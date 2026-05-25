import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { fetchTickets, fetchTicketStats, searchTickets } from '../api/tickets'
import NavBar from '../components/NavBar'
import { formatDate } from '../utils/dateFormat'
import { sanitizeHighlight } from '../utils/sanitize'
import './TicketsPage.css'

const STATUS_CLASS = {
  neu: 'tickets-status--neu', in_bearbeitung: 'tickets-status--progress',
  geloest: 'tickets-status--done', geschlossen: 'tickets-status--closed',
}
const PRIORITY_CLASS = {
  niedrig: 'tickets-priority--low', normal: 'tickets-priority--normal',
  hoch: 'tickets-priority--high', kritisch: 'tickets-priority--critical',
}



export default function TicketsPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [tickets,       setTickets]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [total,         setTotal]         = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterPriority,setFilterPriority]= useState('')
  const [assignedToMe,  setAssignedToMe]  = useState(false)
  const [page,          setPage]          = useState(1)

  // Suche
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState(null)  // null = kein Suchmodus
  const [searching,     setSearching]     = useState(false)
  const searchTimer = useRef(null)

  const PAGE_SIZE = 20

  // ── WebSocket ──────────────────────────────────────────────────────────────
  async function silentStatsRefresh() {
    try { setStats(await fetchTicketStats()) } catch {}
  }


  // ── Ticket-Liste laden ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ticketData, statsData] = await Promise.all([
        fetchTickets({ status: filterStatus || undefined, priority: filterPriority || undefined, assignedToMe, page, pageSize: PAGE_SIZE }),
        fetchTicketStats(),
      ])
      setTickets(ticketData.tickets)
      setTotal(ticketData.total)
      setStats(statsData)
    } catch {
      setError(t('tickets.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPriority, assignedToMe, page])

  useEffect(() => {
    if (!searchQuery) loadData()
  }, [loadData, searchQuery])

  // ── Suche mit Debounce (400ms) ─────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null)
      return
    }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchTickets(searchQuery, {
          status: filterStatus || undefined,
          priority: filterPriority || undefined,
        })
        setSearchResults(data)
      } catch {
        setSearchResults({ results: [], total: 0 })
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery, filterStatus, filterPriority])

  function handleFilterStatus(val)   { setFilterStatus(val);   setPage(1) }
  function handleFilterPriority(val) { setFilterPriority(val); setPage(1) }
  function handleAssignedToMe(val)   { setAssignedToMe(val);   setPage(1) }
  function clearSearch()             { setSearchQuery('');      setSearchResults(null) }

  // ── Anzeigedaten: Suchergebnisse oder normale Liste ────────────────────────
  const isSearchMode   = searchResults !== null
  const displayTickets = isSearchMode ? searchResults.results : tickets
  const isLoading      = isSearchMode ? searching : loading
  const totalPages     = Math.ceil(total / PAGE_SIZE)

  // Suchergebnis-Tickets haben leicht andere Struktur — normalisieren
  function getTicketId(t)     { return t.id }
  function getTicketNumber(t) { return t.ticket_number }
  function getSubject(t)      { return t._highlight?.subject?.[0] ? null : t.subject }
  function getHighlight(t)    { return t._highlight?.subject?.[0] || null }

  return (
    <div className="tickets-page">
      <NavBar />
      <main className="tickets-main">

        {stats && (
          <div className="tickets-kpi-bar">
            <button className="tickets-kpi-card" onClick={() => { setFilterStatus(''); setAssignedToMe(false); setPage(1) }}>
              <div className="tickets-kpi-card__value-wrap">
                <span className="tickets-kpi-card__value">{stats.total}</span>
              </div>
              <div className="tickets-kpi-card__text-wrap">
                <span className="tickets-kpi-card__label">{t('dashboard.stats_total')}</span>
              </div>
            </button>
            <button className="tickets-kpi-card" onClick={() => { setFilterStatus('neu'); setAssignedToMe(false); setPage(1) }}>
              <div className="tickets-kpi-card__value-wrap">
                <span className="tickets-kpi-card__value tickets-kpi-card__value--cyan">{stats.neu}</span>
              </div>
              <div className="tickets-kpi-card__text-wrap">
                <span className="tickets-kpi-card__label">{t('tickets.status_neu')}</span>
                <span className="tickets-kpi-card__sub">Offen & unbearbeitet</span>
              </div>
            </button>
            <button className="tickets-kpi-card" onClick={() => { setFilterStatus('in_bearbeitung'); setAssignedToMe(false); setPage(1) }}>
              <div className="tickets-kpi-card__value-wrap">
                <span className="tickets-kpi-card__value tickets-kpi-card__value--warn">{stats.in_bearbeitung}</span>
              </div>
              <div className="tickets-kpi-card__text-wrap">
                <span className="tickets-kpi-card__label">{t('tickets.status_in_bearbeitung')}</span>
                <span className="tickets-kpi-card__sub">Aktive Tickets</span>
              </div>
            </button>
            <button className="tickets-kpi-card" onClick={() => { setFilterStatus('geloest'); setAssignedToMe(false); setPage(1) }}>
              <div className="tickets-kpi-card__value-wrap">
                <span className="tickets-kpi-card__value tickets-kpi-card__value--success">{stats.geloest}</span>
              </div>
              <div className="tickets-kpi-card__text-wrap">
                <span className="tickets-kpi-card__label">{t('tickets.status_geloest')}</span>
              </div>
            </button>
            <button className="tickets-kpi-card" onClick={() => { setAssignedToMe(true); setFilterStatus(''); setPage(1) }}>
              <div className="tickets-kpi-card__value-wrap">
                <span className="tickets-kpi-card__value tickets-kpi-card__value--cyan">{stats.meine_tickets}</span>
              </div>
              <div className="tickets-kpi-card__text-wrap">
                <span className="tickets-kpi-card__label">{t('tickets.meine_tickets')}</span>
                <span className="tickets-kpi-card__sub">Mir zugewiesen</span>
              </div>
            </button>
            {stats.sla_breached > 0 && (
              <button className="tickets-kpi-card tickets-kpi-card--warn" onClick={() => { setFilterStatus(''); setAssignedToMe(false); setPage(1) }}>
                <div className="tickets-kpi-card__value-wrap">
                  <span className="tickets-kpi-card__value tickets-kpi-card__value--error">{stats.sla_breached}</span>
                </div>
                <div className="tickets-kpi-card__text-wrap">
                  <span className="tickets-kpi-card__label">{t('dashboard.stats_sla')}</span>
                  <span className="tickets-kpi-card__sub">SLA verletzt</span>
                </div>
              </button>
            )}
          </div>
        )}

        <div className="tickets-toolbar glass">
          {/* ── Suchfeld ── */}
          <div className="tickets-search-wrap">
            <span className="tickets-search-icon">🔍</span>
            <input
              className="tickets-search-input"
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('tickets.search_placeholder')}
            />
            {searchQuery && (
              <button className="tickets-search-clear" onClick={clearSearch}>✕</button>
            )}
          </div>

          <div className="tickets-toolbar__filters">
            <select className="tickets-select" value={filterStatus} onChange={e => handleFilterStatus(e.target.value)}>
              <option value="">{t('tickets.filter_status')}</option>
              <option value="neu">{t('tickets.status_neu')}</option>
              <option value="in_bearbeitung">{t('tickets.status_in_bearbeitung')}</option>
              <option value="geloest">{t('tickets.status_geloest')}</option>
              <option value="geschlossen">{t('tickets.status_geschlossen')}</option>
            </select>
            <select className="tickets-select" value={filterPriority} onChange={e => handleFilterPriority(e.target.value)}>
              <option value="">{t('tickets.filter_priority')}</option>
              <option value="kritisch">{t('tickets.priority_kritisch')}</option>
              <option value="hoch">{t('tickets.priority_hoch')}</option>
              <option value="normal">{t('tickets.priority_normal')}</option>
              <option value="niedrig">{t('tickets.priority_niedrig')}</option>
            </select>
            {!isSearchMode && (
              <label className="tickets-checkbox-label">
                <input type="checkbox" checked={assignedToMe} onChange={e => handleAssignedToMe(e.target.checked)} />
                {t('tickets.filter_mine')}
              </label>
            )}
          </div>
          <button className="tickets-btn-new" onClick={() => navigate('/tickets/new')}>
            {t('tickets.new_ticket')}
          </button>
        </div>

        {/* ── Suchmodus-Info ── */}
        {isSearchMode && !searching && (
          <div className="tickets-search-info">
            {t('tickets.search_results', { count: searchResults.total, query: searchQuery })}
            <button className="tickets-search-reset" onClick={clearSearch}>✕ Suche beenden</button>
          </div>
        )}

        {error && <div className="tickets-error">{error}</div>}

        <div className="tickets-table-wrap glass">
          {isLoading ? (
            <div className="tickets-loading">
              <div className="tickets-spinner" />
              <span>{isSearchMode ? t('common.search') + '…' : t('tickets.loading')}</span>
            </div>
          ) : displayTickets.length === 0 ? (
            <div className="tickets-empty">
              <span className="tickets-empty__icon">📭</span>
              <p>{isSearchMode
                ? t('tickets.search_empty', { query: searchQuery })
                : t('tickets.empty')}
              </p>
            </div>
          ) : (
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>{t('tickets.col_number')}</th>
                  <th>{t('tickets.col_subject')}</th>
                  <th>{t('tickets.col_status')}</th>
                  <th>{t('tickets.col_priority')}</th>
                  <th>{t('tickets.col_created')}</th>
                  <th>{t('tickets.col_agent')}</th>
                </tr>
              </thead>
              <tbody>
                {displayTickets.map(ticket => (
                  <tr key={ticket.id} className="tickets-table__row"
                    onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td><span className="tickets-number">{ticket.ticket_number}</span></td>
                    <td>
                      <span className="tickets-subject"
                        dangerouslySetInnerHTML={{ __html: sanitizeHighlight(ticket._highlight?.subject?.[0] || ticket.subject) }}
                      />
                      {ticket.tags?.length > 0 && (
                        <div className="tickets-tags">
                          {ticket.tags.map(tag => <span key={tag} className="tickets-tag">{tag}</span>)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`tickets-status ${STATUS_CLASS[ticket.status]}`}>
                        {t(`tickets.status_${ticket.status}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`tickets-priority ${PRIORITY_CLASS[ticket.priority]}`}>
                        {t(`tickets.priority_${ticket.priority}`)}
                      </span>
                    </td>
                    <td className="tickets-date">{ticket.created_at ? formatDate(ticket.created_at) : '—'}</td>
                    <td className="tickets-agent">
                      {ticket.assigned_agent_name || ticket.assigned_agent?.display_name ||
                        <span className="tickets-unassigned">{t('tickets.unassigned')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!isSearchMode && totalPages > 1 && (
          <div className="tickets-pagination">
            <button className="tickets-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              {t('tickets.page_back')}
            </button>
            <span className="tickets-page-info">
              {t('tickets.page_info', { page, total: totalPages, count: total })}
            </span>
            <button className="tickets-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              {t('tickets.page_next')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
