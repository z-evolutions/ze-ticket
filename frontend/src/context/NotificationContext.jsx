import { createContext, useContext, useState } from 'react'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [ticketNotifs, setTicketNotifs] = useState([])
  const [commentNotifs, setCommentNotifs] = useState([])

  return (
    <NotificationContext.Provider value={{
      ticketNotifs, setTicketNotifs,
      commentNotifs, setCommentNotifs,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) return {
    ticketNotifs: [], setTicketNotifs: () => {},
    commentNotifs: [], setCommentNotifs: () => {},
  }
  return ctx
}
