let state = { ticketNotifs: [], commentNotifs: [] }
let listeners = []

export function getNotifications() { return state }

export function addTicketNotif(notif) {
  state = { ...state, ticketNotifs: [notif, ...state.ticketNotifs].slice(0, 20) }
  listeners.forEach(l => l(state))
}

export function addCommentNotif(notif) {
  state = { ...state, commentNotifs: [notif, ...state.commentNotifs].slice(0, 20) }
  listeners.forEach(l => l(state))
}

export function clearTicketNotifs() {
  state = { ...state, ticketNotifs: [] }
  listeners.forEach(l => l(state))
}

export function clearCommentNotifs() {
  state = { ...state, commentNotifs: [] }
  listeners.forEach(l => l(state))
}

export function clearCommentNotifsForTicket(ticket_id) {
  state = { ...state, commentNotifs: state.commentNotifs.filter(n => n.ticket_id !== ticket_id) }
  listeners.forEach(l => l(state))
}

export function subscribe(fn) {
  listeners = [...listeners, fn]
  return () => { listeners = listeners.filter(l => l !== fn) }
}
