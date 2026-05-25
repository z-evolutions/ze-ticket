import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useWebSocket } from '../hooks/useWebSocket'
import { fetchTicket, addComment } from '../api/tickets'
import axios from 'axios'
import './PortalTicketDetailPage.css'
import { formatDate } from '../utils/dateFormat'
import TicketAttachments from '../components/TicketAttachments'

const STATUS_CLASS = {
  neu: 'portal-badge--neu', in_bearbeitung: 'portal-badge--progress',
  geloest: 'portal-badge--done', geschlossen: 'portal-badge--closed',
}



export default function PortalTicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const commentEndRef = useRef(null)

  const [ticket,        setTicket]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [agentOnline,   setAgentOnline]   = useState(false)
  const [agentName,     setAgentName]     = useState('')
  const [commentText,   setCommentText]   = useState('')
  const [sending,       setSending]       = useState(false)
  const [commentError,  setCommentError]  = useState(null)

  async function loadTicket() {
    try {
      const data = await fetchTicket(id)
      setTicket(data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadTicket() }, [id])

  useEffect(() => {
    if (commentEndRef.current) {
      commentEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [ticket?.comments])

  // WebSocket — Agent-Präsenz + neue Kommentare
  const token = localStorage.getItem('ze-token')
  useWebSocket(token, useCallback((event) => {
    if (event.type === 'agent_joined' && event.ticket_id === id) {
      setAgentOnline(true)
      setAgentName(event.agent_name || '')
    } else if (event.type === 'agent_left' && event.ticket_id === id) {
      setAgentOnline(false)
      setAgentName('')
    } else if (event.type === 'new_comment' && event.ticket_id === id) {
      loadTicket()
    } else if (event.type === 'ticket_update' && event.ticket_id === id) {
      loadTicket()
    }
  }, [id]))

  async function handleSendComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSending(true); setCommentError(null)
    try {
      const newComment = await addComment(id, {
        content: commentText,
        comment_type: 'antwort',
      })
      setTicket(prev => ({ ...prev, comments: [...prev.comments, newComment] }))
      setCommentText('')
    } catch {
      setCommentError('Nachricht konnte nicht gesendet werden.')
    } finally { setSending(false) }
  }

  // Nur öffentliche Kommentare (keine internen Notizen) für Kunden
  const publicComments = ticket?.comments.filter(c => c.comment_type === 'antwort') || []

  return (
    <div className="portal-page">
      <header className="portal-header glass">
        <div className="portal-header__brand" onClick={() => navigate('/portal')}>
          <div className="portal-header__logo">ZE</div>
          <span className="portal-header__title">ZE-Ticket</span>
          <span className="portal-header__badge">Portal</span>
        </div>
        <div className="portal-header__actions">
          <button className="portal-theme-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="portal-pw-link" onClick={() => navigate('/portal/passwort')}>
            🔑 {user?.display_name}
          </button>
          <button className="portal-logout-btn" onClick={() => { logout(); window.location.href = '/login' }}>{t('portal.logout')}</button>
        </div>
      </header>

      <main className="portal-main">
        <div className="portal-breadcrumb">
          <button className="portal-back-btn" onClick={() => navigate('/portal')}>
            {t('portal.back_to_tickets')}
          </button>
          {ticket && <span className="portal-ticket-number">{ticket.ticket_number}</span>}
        </div>

        {loading && <div className="portal-loading"><div className="portal-spinner" /></div>}

        {ticket && !loading && (
          <div className="portal-detail-layout">

            {/* ── Ticket-Info ── */}
            <div className="portal-detail-card glass">
              <div className="portal-detail-header">
                <h1 className="portal-detail-subject">{ticket.subject}</h1>
                <span className={`portal-badge ${STATUS_CLASS[ticket.status]}`}>
                  {t(`tickets.status_${ticket.status}`)}
                </span>
              </div>
              <div className="portal-detail-description">
                {ticket.description.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
              <div className="portal-detail-meta">
                <span>Erstellt: {formatDate(ticket.created_at)}</span>
                {ticket.assigned_agent && (
                  <span>Agent: {ticket.assigned_agent.display_name}</span>
                )}
              </div>
            </div>

            {/* ── Ansprechpartner ── */}
            {ticket.assigned_agent && (
              <div className="portal-presence glass">
                <div className="portal-presence__dot portal-presence__dot--neutral" />
                <div className="portal-presence__text">
                  <span className="portal-presence__status">
                    Ihr Ansprechpartner: {ticket.assigned_agent.display_name}
                  </span>
                  <span className="portal-presence__hint">
                    Sie können eine Nachricht hinterlassen — der Agent antwortet beim nächsten Besuch.
                  </span>
                </div>
              </div>
            )}
            {!ticket.assigned_agent && (
              <div className="portal-presence glass">
                <div className="portal-presence__dot portal-presence__dot--neutral" />
                <div className="portal-presence__text">
                  <span className="portal-presence__status">Support-Team</span>
                  <span className="portal-presence__hint">
                    Ihr Ticket wird baldmöglichst bearbeitet.
                  </span>
                </div>
              </div>
            )}

            {/* ── Anhänge ── */}
            <TicketAttachments ticketId={ticket.id} isAgent={true} />

            {/* ── Chat-Verlauf ── */}
            <div className="portal-chat glass">
              <h2 className="portal-chat__title">Verlauf ({publicComments.length})</h2>

              <div className="portal-chat__messages">
                {publicComments.length === 0 ? (
                  <div className="portal-chat__empty">Noch keine Nachrichten.</div>
                ) : (
                  publicComments.map(comment => {
                    const isOwn = comment.author?.id === user?.id
                    return (
                      <div key={comment.id}
                        className={`portal-message ${isOwn ? 'portal-message--own' : 'portal-message--agent'}`}>
                        <div className="portal-message__bubble">
                          {comment.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                        <div className="portal-message__meta">
                          <span>{comment.author?.display_name || 'System'}</span>
                          <span>{formatDate(comment.created_at)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={commentEndRef} />
              </div>

              {/* ── Eingabe ── */}
              {ticket.status !== 'geschlossen' ? (
                <form className="portal-chat__form" onSubmit={handleSendComment}>
                  {!agentOnline && (
                    <div className="portal-chat__offline-hint">
                      💬 Sie können eine Nachricht hinterlassen — der Agent antwortet beim nächsten Besuch.
                    </div>
                  )}
                  <div className="portal-chat__input-row">
                    <textarea
                      className="portal-chat__input"
                      placeholder={t('portal.reply_placeholder')}
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      rows={3}

                    />
                    <button type="submit" className="portal-chat__send-btn"
                      disabled={!commentText.trim() || sending}>
                      {sending ? '…' : '➤'}
                    </button>
                  </div>
                  {commentError && <div className="portal-chat__error">{commentError}</div>}
                  <span className="portal-chat__hint">Shift+Enter für neue Zeile</span>
                </form>
              ) : (
                <div className="portal-chat__closed">Dieses Ticket ist geschlossen.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
