import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getNotifications, clearTicketNotifs, clearCommentNotifs, subscribe } from '../store/notifications'
import './NotificationBells.css'

function Bell({ icon, count, items, onClear }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="nbell" ref={ref}>
      <button className="nbell__btn" onClick={() => setOpen(o => !o)}>
        <span>{icon}</span>
        {count > 0 && <span className="nbell__badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="nbell__dropdown">
          <div className="nbell__header">
            <span>{count > 0 ? t('notifications.count_new', { count }) : t('notifications.none_new')}</span>
            {count > 0 && <button className="nbell__clear" onClick={() => { onClear(); setOpen(false) }}>{t('notifications.clear_all')}</button>}
          </div>
          {items.length === 0 ? (
            <div className="nbell__empty">{t('notifications.empty')}</div>
          ) : (
            <div className="nbell__list">
              {items.map((item, i) => (
                <button key={i} className="nbell__item"
                  onClick={() => { navigate(`/tickets/${item.ticket_id}`); setOpen(false) }}>
                  <span className="nbell__item-number">{item.ticket_number}</span>
                  <span className="nbell__item-text">{item.text}</span>
                  <span className="nbell__item-time">{item.time}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function NotificationBells() {
  const [ticketNotifs, setTicketNotifs] = useState([])
  const [commentNotifs, setCommentNotifs] = useState([])

  useEffect(() => {
    const initial = getNotifications()
    setTicketNotifs(initial.ticketNotifs || [])
    setCommentNotifs(initial.commentNotifs || [])
    return subscribe((state) => {
      setTicketNotifs(state.ticketNotifs || [])
      setCommentNotifs(state.commentNotifs || [])
    })
  }, [])

  return (
    <>
      <Bell icon="🔔" count={ticketNotifs.length} items={ticketNotifs} onClear={clearTicketNotifs} />
      <Bell icon="💬" count={commentNotifs.length} items={commentNotifs} onClear={clearCommentNotifs} />
    </>
  )
}
