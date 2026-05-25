import { describe, it, expect, beforeEach } from 'vitest'
import {
  getNotifications,
  addTicketNotif,
  addCommentNotif,
  clearTicketNotifs,
  clearCommentNotifs,
  clearCommentNotifsForTicket,
  subscribe,
} from '../store/notifications'

beforeEach(() => {
  clearTicketNotifs()
  clearCommentNotifs()
})

describe('Notification Store', () => {
  it('startet leer', () => {
    const state = getNotifications()
    expect(state.ticketNotifs).toHaveLength(0)
    expect(state.commentNotifs).toHaveLength(0)
  })

  it('fügt Ticket-Benachrichtigung hinzu', () => {
    addTicketNotif({ ticket_number: 'ZE-2026-0001', ticket_id: '123', text: 'Neu', time: '10:00' })
    expect(getNotifications().ticketNotifs).toHaveLength(1)
    expect(getNotifications().ticketNotifs[0].ticket_number).toBe('ZE-2026-0001')
  })

  it('fügt Kommentar-Benachrichtigung hinzu', () => {
    addCommentNotif({ ticket_number: 'ZE-2026-0001', ticket_id: '123', text: 'Antwort', time: '10:00' })
    expect(getNotifications().commentNotifs).toHaveLength(1)
  })

  it('begrenzt Ticket-Notifs auf 20', () => {
    for (let i = 0; i < 25; i++) {
      addTicketNotif({ ticket_number: `ZE-2026-00${i}`, ticket_id: `${i}`, text: 'Neu', time: '10:00' })
    }
    expect(getNotifications().ticketNotifs).toHaveLength(20)
  })

  it('löscht alle Ticket-Benachrichtigungen', () => {
    addTicketNotif({ ticket_number: 'ZE-2026-0001', ticket_id: '1', text: 'Neu', time: '10:00' })
    clearTicketNotifs()
    expect(getNotifications().ticketNotifs).toHaveLength(0)
  })

  it('löscht Kommentare nur für ein Ticket', () => {
    addCommentNotif({ ticket_number: 'ZE-2026-0001', ticket_id: 'abc', text: 'A', time: '10:00' })
    addCommentNotif({ ticket_number: 'ZE-2026-0002', ticket_id: 'def', text: 'B', time: '10:00' })
    clearCommentNotifsForTicket('abc')
    const notifs = getNotifications().commentNotifs
    expect(notifs).toHaveLength(1)
    expect(notifs[0].ticket_id).toBe('def')
  })

  it('benachrichtigt Subscriber bei Änderung', () => {
    let called = false
    const unsub = subscribe(() => { called = true })
    addTicketNotif({ ticket_number: 'ZE-2026-0001', ticket_id: '1', text: 'Neu', time: '10:00' })
    expect(called).toBe(true)
    unsub()
  })

  it('entfernt Subscriber korrekt', () => {
    let count = 0
    const unsub = subscribe(() => { count++ })
    addTicketNotif({ ticket_number: 'ZE-2026-0001', ticket_id: '1', text: 'Neu', time: '10:00' })
    unsub()
    addTicketNotif({ ticket_number: 'ZE-2026-0002', ticket_id: '2', text: 'Neu', time: '10:00' })
    expect(count).toBe(1) // Nur einmal aufgerufen
  })
})
