import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useWebSocket } from '../hooks/useWebSocket'
import axios from 'axios'
import './PortalTicketsPage.css'
import { formatDate } from '../utils/dateFormat'
import { useLogo } from '../hooks/useLogo'

const STATUS_CLASS = {
  neu: 'portal-badge--neu', in_bearbeitung: 'portal-badge--progress',
  geloest: 'portal-badge--done', geschlossen: 'portal-badge--closed',
}

export default function PortalTicketsPage() {
  const { user, logout } = useAuth()
  const logoUrl = useLogo()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadTickets() {
    try {
      const res = await axios.get('/api/portal/my-tickets')
      setTickets(res.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadTickets() }, [])

  const token = localStorage.getItem('ze-token')
  useWebSocket(token, useCallback((event) => {
    if (event.type === 'ticket_update' || event.type === 'new_comment') {
      loadTickets()
    }
  }, []))

  return (
    <div className="portal-page">
      <header className="portal-header glass">
        <div className="portal-header__brand" onClick={() => navigate('/portal')}>
          <div className="portal-header__logo">
            {logoUrl
              ? <img src={logoUrl} alt="ZE-Ticket" className="portal-header__logo-img" />
              : <span>ZE</span>
            }
          </div>
          <span className="portal-header__title">ZE-Ticket</span>
          <span className="portal-header__badge">Portal</span>
        </div>
        <div className="portal-header__actions">
          <button className="portal-theme-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="portal-pw-link" onClick={() => navigate('/portal/passwort')}>
            🔑 {user?.display_name}
          </button>
          <button className="portal-logout-btn" onClick={() => { logout(); window.location.href = '/login' }}>
            {t('portal.logout')}
          </button>
        </div>
      </header>

      <main className="portal-main">
        <div className="portal-toolbar">
          <div>
            <h1 className="portal-title">{t('portal.my_tickets')}</h1>
            <p className="portal-sub">{t('portal.my_tickets_sub')}</p>
          </div>
        </div>

        {loading ? (
          <div className="portal-loading"><div className="portal-spinner" /></div>
        ) : tickets.length === 0 ? (
          <div className="portal-empty glass">
            <span>📭</span>
            <p>{t('portal.no_tickets')}</p>
          </div>
        ) : (
          <div className="portal-tickets">
            {tickets.map(ticket => (
              <div key={ticket.id} className="portal-ticket-card glass"
                onClick={() => navigate(`/portal/tickets/${ticket.id}`)}>
                <div className="portal-ticket-card__header">
                  <span className="portal-ticket-number">{ticket.ticket_number}</span>
                  <span className={`portal-badge ${STATUS_CLASS[ticket.status]}`}>
                    {t(`tickets.status_${ticket.status}`)}
                  </span>
                </div>
                <h3 className="portal-ticket-subject">{ticket.subject}</h3>
                <div className="portal-ticket-meta">
                  <span>{t('tickets.col_created')}: {formatDate(ticket.created_at)}</span>
                  <span>{t('portal.detail_updated')}: {formatDate(ticket.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
