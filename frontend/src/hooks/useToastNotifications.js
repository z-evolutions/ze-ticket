import toast from 'react-hot-toast'
import { useWebSocket } from './useWebSocket'
import { useAuth } from '../context/AuthContext'
import { addTicketNotif, addCommentNotif } from '../store/notifications'

const HIGH_PRIOS = ['hoch', 'kritisch']
const TOAST_STYLE = {
  background: '#0d1b3e', color: '#e0e0e0',
  border: '1px solid #00d4ff33', borderRadius: '8px', fontSize: '0.85rem',
}

export function useToastNotifications(token, onEvent) {
  const { user } = useAuth()
  function handleEvent(event) {
    const { type, ticket_number, ticket_id, action, data = {} } = event
    const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

    if (type === 'ticket_update') {
      if (action === 'created') {
        addTicketNotif({ ticket_number, ticket_id, text: 'Neues Ticket eingegangen', time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) })
        // Toast
        toast(`🎫 Neues Ticket: ${ticket_number}`, {
          style: { ...TOAST_STYLE, borderColor: '#00d4ff55' }, duration: 5000,
        })
      } else if (action === 'updated' && HIGH_PRIOS.includes(data.priority)) {
        const icon = data.priority === 'kritisch' ? '🔴' : '🟠'
        toast(`${icon} Ticket aktualisiert: ${ticket_number}`, {
          style: { ...TOAST_STYLE, borderColor: data.priority === 'kritisch' ? '#ef4444' : '#f59e0b' },
          duration: 4000,
        })
      }
    }

    if (type === 'new_comment' && data.assigned_agent_id === user?.id && data.author_id !== user?.id && event.comment_type === 'antwort') {
      addCommentNotif({ ticket_number, ticket_id, text: 'Neue Antwort auf Ticket', time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) })
      toast(`💬 Neue Antwort auf ${ticket_number}`, {
        style: { ...TOAST_STYLE, borderColor: '#22c55e55' }, duration: 4000,
      })
    }

    if (onEvent) onEvent(event)
  }

  useWebSocket(token, handleEvent)
}
