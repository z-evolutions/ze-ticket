import { useEffect, useRef, useCallback } from 'react'

const WS_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}/ws/tickets`
  : `ws://${window.location.host}/ws/tickets`

const RECONNECT_DELAY = 3000
const PING_INTERVAL   = 30000

/**
 * useWebSocket — hält eine persistente WebSocket-Verbindung.
 *
 * @param {string|null} token  JWT Access Token
 * @param {function}    onEvent  Callback für eingehende Events: (event) => void
 */
export function useWebSocket(token, onEvent) {
  const wsRef          = useRef(null)
  const reconnectTimer = useRef(null)
  const pingTimer      = useRef(null)
  const onEventRef     = useRef(onEvent)

  // onEvent immer aktuell halten ohne reconnect zu triggern
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const connect = useCallback(() => {
    if (!token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_URL}?token=${token}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Verbunden')
      // Ping alle 30s um Verbindung zu halten
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, PING_INTERVAL)
    }

    ws.onmessage = (e) => {
      if (e.data === 'pong') return  // Ping-Antwort ignorieren
      try {
        const event = JSON.parse(e.data)
        if (event.type !== 'connected') {
          onEventRef.current?.(event)
        }
      } catch {}
    }

    ws.onclose = (e) => {
      console.log(`[WS] Getrennt (${e.code}) — reconnect in ${RECONNECT_DELAY}ms`)
      clearInterval(pingTimer.current)
      // Nur reconnecten bei unerwartetem Disconnect (nicht bei 4001 = Auth-Fehler)
      if (e.code !== 4001 && e.code !== 1000) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      wsRef.current?.close(1000, 'Component unmounted')
    }
  }, [token, connect])
}
