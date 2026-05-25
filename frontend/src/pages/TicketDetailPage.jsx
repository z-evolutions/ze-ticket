import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import { clearCommentNotifsForTicket } from '../store/notifications'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { fetchTicket, updateTicket, addComment } from '../api/tickets'
import axios from 'axios'
import { fetchAgents } from '../api/users'
import NavBar from '../components/NavBar'
import { formatDate } from '../utils/dateFormat'
import TicketChecklist from '../components/TicketChecklist'
import TicketAttachments from '../components/TicketAttachments'
import './TicketDetailPage.css'

const STATUS_CLASS = {
  neu: 'detail-badge--neu', in_bearbeitung: 'detail-badge--progress',
  geloest: 'detail-badge--done', geschlossen: 'detail-badge--closed',
}
const PRIORITY_CLASS = {
  niedrig: 'detail-badge--low', normal: 'detail-badge--normal',
  hoch: 'detail-badge--high', kritisch: 'detail-badge--critical',
}
const COMMENT_TYPE_CLASS = {
  antwort: 'detail-comment--antwort', interne_notiz: 'detail-comment--notiz',
}



export default function TicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const commentBoxRef = useRef(null)

  const [ticket,   setTicket]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [status,   setStatus]   = useState('')
  const [priority, setPriority] = useState('')
  const [agentId,  setAgentId]  = useState('')
  const [groupId,  setGroupId]  = useState('')
  const [groups,   setGroups]   = useState([])
  const [agents,   setAgents]   = useState([])
  const [commentContent, setCommentContent] = useState('')
  const [commentType,    setCommentType]    = useState('antwort')
  const [commentSending, setCommentSending] = useState(false)
  const [commentError,   setCommentError]   = useState(null)

  const isAgent = user?.role && ['agent', 'manager', 'admin', 'superadmin'].includes(user.role)

  // Stiller Kommentar-Refresh — kein Flackern
  async function silentRefreshComments() {
    try {
      const data = await fetchTicket(id)
      setTicket(prev => prev ? { ...prev, comments: data.comments } : data)
    } catch {}
  }

  async function silentRefreshTicket() {
    try {
      const data = await fetchTicket(id)
      setTicket(data)
      setStatus(data.status)
      setPriority(data.priority)
      setAgentId(data.assigned_agent?.id || '')
      setGroupId(data.assigned_group_id || '')
    } catch {}
  }

  // WebSocket — Live-Updates für dieses Ticket
  const handleWsEvent = useCallback((event) => {
    if (!event.ticket_id) return
    // Nur Events für dieses Ticket verarbeiten
    if (event.ticket_id !== id) return
    if (event.type === 'ticket_update') {
      silentRefreshTicket()
    } else if (event.type === 'new_comment') {
      silentRefreshComments()
    }
  }, [id])

  const token = localStorage.getItem('ze-token')
  useWebSocket(token, handleWsEvent)
  useEffect(() => { clearCommentNotifsForTicket(id) }, [id])

  const STATUS_OPTIONS = [
    { value: 'neu',            label: t('tickets.status_neu') },
    { value: 'in_bearbeitung', label: t('tickets.status_in_bearbeitung') },
    { value: 'geloest',        label: t('tickets.status_geloest') },
    { value: 'geschlossen',    label: t('tickets.status_geschlossen') },
  ]
  const PRIORITY_OPTIONS = [
    { value: 'niedrig',  label: t('tickets.priority_niedrig') },
    { value: 'normal',   label: t('tickets.priority_normal') },
    { value: 'hoch',     label: t('tickets.priority_hoch') },
    { value: 'kritisch', label: t('tickets.priority_kritisch') },
  ]

  useEffect(() => {
    loadTicket()
    if (isAgent) { loadAgents(); loadGroups(); }
  }, [id])

  // Gruppe setzen sobald ticket + groups geladen
  useEffect(() => {
    if (ticket && groups.length > 0) {
      setGroupId(ticket.assigned_group_id || '')
    }
  }, [ticket, groups])

  async function loadTicket() {
    setLoading(true); setError(null)
    try {
      const data = await fetchTicket(id)
      setTicket(data); setStatus(data.status)
      setPriority(data.priority); setAgentId(data.assigned_agent?.id || '')
    } catch { setError(t('ticket_detail.not_found')) }
    finally { setLoading(false) }
  }

  async function loadAgents() {
    try { setAgents(await fetchAgents()) } catch {}
  }
  async function loadGroups() {
    try {
      const res = await axios.get('/api/groups/')
      setGroups(res.data.groups || res.data)
    } catch {}
  }

  async function handleSave() {
    setSaving(true); setSavedMsg('')
    try {
      const updated = await updateTicket(id, { status, priority, assigned_agent_id: agentId || null, assigned_group_id: groupId || null })
      setTicket(updated); setStatus(updated.status)
      setPriority(updated.priority); setAgentId(updated.assigned_agent?.id || '')
      setGroupId(updated.assigned_group_id || '')
      setSavedMsg(t('ticket_detail.saved'))
      setTimeout(() => setSavedMsg(''), 2500)
    } catch { setSavedMsg(t('ticket_detail.save_error')) }
    finally { setSaving(false) }
  }

  async function handleCommentSubmit(e) {
    e.preventDefault()
    if (!commentContent.trim()) return
    setCommentSending(true); setCommentError(null)
    try {
      const newComment = await addComment(id, { content: commentContent, comment_type: commentType })
      setTicket(prev => ({ ...prev, comments: [...prev.comments, newComment] }))
      setCommentContent('')
      setTimeout(() => commentBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    } catch { setCommentError(t('ticket_detail.comment_error')) }
    finally { setCommentSending(false) }
  }

  const hasChanges = ticket && (
    status !== ticket.status || priority !== ticket.priority ||
    agentId !== (ticket.assigned_agent?.id || '') ||
    groupId !== (ticket.assigned_group_id || '')
  )

  return (
    <div className="detail-page">
      <NavBar />
      <main className="detail-main">

        <div className="detail-breadcrumb">
          <button className="detail-back-btn" onClick={() => navigate('/tickets')}>
            {t('ticket_detail.back')}
          </button>
          {ticket && <span className="detail-breadcrumb__number">{ticket.ticket_number}</span>}
        </div>

        {error && <div className="detail-error">{error}</div>}
        {loading && <div className="detail-loading"><div className="detail-spinner" /><span>{t('ticket_detail.loading')}</span></div>}

        {ticket && !loading && (
          <div className="detail-layout">
            <div className="detail-content">

              <div className="detail-card glass">
                <div className="detail-card__header">
                  <h1 className="detail-subject">{ticket.subject}</h1>
                  <div className="detail-meta">
                    <span className={`detail-badge ${STATUS_CLASS[ticket.status]}`}>
                      {STATUS_OPTIONS.find(s => s.value === ticket.status)?.label}
                    </span>
                    <span className={`detail-badge ${PRIORITY_CLASS[ticket.priority]}`}>
                      {PRIORITY_OPTIONS.find(p => p.value === ticket.priority)?.label}
                    </span>
                    <span className="detail-channel">
                      {ticket.channel === 'email' ? `📧 ${t('tickets.channel_email')}` : `🌐 ${t('tickets.channel_web')}`}
                    </span>
                  </div>
                </div>
                {ticket.tags.length > 0 && (
                  <div className="detail-tags">
                    {ticket.tags.map(tag => <span key={tag} className="detail-tag">{tag}</span>)}
                  </div>
                )}
                <div className="detail-description">
                  {ticket.description.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
                <div className="detail-timestamps">
                  <span>Erstellt: {formatDate(ticket.created_at)}</span>
                  <span>Aktualisiert: {formatDate(ticket.updated_at)}</span>
                </div>
              </div>

              <TicketAttachments ticketId={ticket.id} isAgent={isAgent} />

              <div className="detail-comments" ref={commentBoxRef}>
                <h2 className="detail-section-title">
                  {t('ticket_detail.history')}
                  <span className="detail-section-count">{ticket.comments.length}</span>
                </h2>

                {ticket.comments.length === 0 ? (
                  <div className="detail-no-comments glass"><span>{t('ticket_detail.no_comments')}</span></div>
                ) : (
                  ticket.comments.map(comment => (
                    <div key={comment.id} className={`detail-comment glass ${COMMENT_TYPE_CLASS[comment.comment_type]}`}>
                      <div className="detail-comment__header">
                        <span className="detail-comment__author">
                          {comment.author?.display_name || t('ticket_detail.author_system')}
                        </span>
                        <span className="detail-comment__type-badge">
                          {comment.comment_type === 'antwort' ? t('ticket_detail.comment_type_reply') : t('ticket_detail.comment_type_note')}
                        </span>
                        <span className="detail-comment__date">{formatDate(comment.created_at)}</span>
                      </div>
                      <div className="detail-comment__body">
                        {comment.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                      </div>
                    </div>
                  ))
                )}

                {ticket.status !== 'geschlossen' && (
                  <form className="detail-comment-form glass" onSubmit={handleCommentSubmit}>
                    <div className="detail-comment-form__header">
                      <span className="detail-comment-form__title">{t('ticket_detail.compose')}</span>
                      {isAgent && (
                        <div className="detail-type-toggle">
                          <button type="button"
                            className={`detail-type-btn ${commentType === 'antwort' ? 'detail-type-btn--active-antwort' : ''}`}
                            onClick={() => setCommentType('antwort')}>
                            {t('ticket_detail.type_reply')}
                          </button>
                          <button type="button"
                            className={`detail-type-btn ${commentType === 'interne_notiz' ? 'detail-type-btn--active-notiz' : ''}`}
                            onClick={() => setCommentType('interne_notiz')}>
                            {t('ticket_detail.type_note')}
                          </button>
                        </div>
                      )}
                    </div>
                    {commentType === 'interne_notiz' && (
                      <div className="detail-notiz-hint">{t('ticket_detail.note_hint')}</div>
                    )}
                    <textarea
                      className={`detail-comment-textarea ${commentType === 'interne_notiz' ? 'detail-comment-textarea--notiz' : ''}`}
                      placeholder={commentType === 'interne_notiz' ? t('ticket_detail.placeholder_note') : t('ticket_detail.placeholder_reply')}
                      value={commentContent}
                      onChange={e => setCommentContent(e.target.value)}
                      rows={5}
                    />
                    {commentError && <div className="detail-comment-error">{commentError}</div>}
                    <div className="detail-comment-form__footer">
                      <button type="button" className="detail-comment-discard"
                        onClick={() => { setCommentContent(''); setCommentError(null) }}
                        disabled={!commentContent}>
                        {t('ticket_detail.discard')}
                      </button>
                      <button type="submit"
                        className={`detail-comment-submit ${commentType === 'interne_notiz' ? 'detail-comment-submit--notiz' : ''}`}
                        disabled={!commentContent.trim() || commentSending}>
                        {commentSending ? t('ticket_detail.sending')
                          : commentType === 'interne_notiz' ? t('ticket_detail.send_note')
                          : t('ticket_detail.send_reply')}
                      </button>
                    </div>
                  </form>
                )}
                {ticket.status === 'geschlossen' && (
                  <div className="detail-closed-hint">{t('ticket_detail.closed_hint')}</div>
                )}
              </div>
            </div>

            <aside className="detail-sidebar">
              {isAgent && (
                <div className="detail-sidebar-card glass">
                  <h3 className="detail-sidebar-title">{t('ticket_detail.sidebar_edit')}</h3>
                  <label className="detail-sidebar-label">{t('ticket_detail.sidebar_status')}</label>
                  <select className="detail-select" value={status} onChange={e => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <label className="detail-sidebar-label">{t('ticket_detail.sidebar_priority')}</label>
                  <select className="detail-select" value={priority} onChange={e => setPriority(e.target.value)}>
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <label className="detail-sidebar-label">{t('ticket_detail.sidebar_agent')}</label>
                  <select className="detail-select" value={agentId} onChange={e => setAgentId(e.target.value)}>
                    <option value="">{t('ticket_detail.sidebar_unassigned')}</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                  </select>
                  <label className="detail-sidebar-label">Gruppe</label>
                  <select className="detail-select" value={groupId} onChange={e => setGroupId(e.target.value)}>
                    <option value="">— {t('ticket_detail.sidebar_no_group')} —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {/* Ticket übernehmen — nur wenn nicht mir zugewiesen */}
                  {!ticket?.assigned_agent || ticket.assigned_agent.id !== user?.id ? (
                    <button className="detail-take-btn" onClick={async () => {
                      await updateTicket(id, { assigned_agent_id: user.id })
                      const refreshed = await fetchTicket(id)
                      setTicket(refreshed)
                      setAgentId(user.id)
                    }}>
                      🙋 Ticket übernehmen
                    </button>
                  ) : null}
                  <button className="detail-save-btn" onClick={handleSave} disabled={!hasChanges || saving}>
                    {saving ? t('ticket_detail.sidebar_saving') : t('ticket_detail.sidebar_save')}
                  </button>
                  {savedMsg && (
                    <span className={`detail-saved-msg ${savedMsg.includes('Fehler') || savedMsg.includes('Error') ? 'detail-saved-msg--error' : ''}`}>
                      {savedMsg}
                    </span>
                  )}
                </div>
              )}
              <div className="detail-sidebar-card glass">
                <h3 className="detail-sidebar-title">{t('ticket_detail.info_title')}</h3>
                <div className="detail-info-row">
                  <span className="detail-info-label">{t('ticket_detail.info_number')}</span>
                  <span className="detail-info-value detail-info-value--cyan">{ticket.ticket_number}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">{t('ticket_detail.info_channel')}</span>
                  <span className="detail-info-value">
                    {ticket.channel === 'email' ? t('tickets.channel_email') : t('tickets.channel_web')}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">{t('ticket_detail.info_agent')}</span>
                  <span className="detail-info-value">
                    {ticket.assigned_agent?.display_name || <span className="detail-unassigned">{t('ticket_detail.info_not_assigned')}</span>}
                  </span>
                </div>
                {ticket.sla_due_at && (
                  <div className="detail-info-row">
                    <span className="detail-info-label">{t('ticket_detail.info_sla')}</span>
                    <span className={`detail-info-value ${ticket.sla_breached ? 'detail-info-value--error' : ''}`}>
                      {formatDate(ticket.sla_due_at)}{ticket.sla_breached && ' ⚠️'}
                    </span>
                  </div>
                )}
              </div>
              {isAgent && (
                <TicketChecklist ticketId={ticket.id} />
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
