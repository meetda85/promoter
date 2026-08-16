import { useCallback, useEffect, useRef, useState } from 'react'
import { RemoteLink, type LinkStatus } from '../lib/remote/transport'
import type { RemoteMessage, RemoteState } from '../lib/remote/protocol'

export interface ClientLink {
  status: LinkStatus
  detail?: string
  hostOnline: boolean
  state: RemoteState | null
  send: (msg: RemoteMessage) => void
  reconnect: () => void
}

/** Lado mando: se conecta a la sala y refleja el estado del teleprompter. */
export function useRemoteClient(serverUrl: string, room: string, enabled: boolean): ClientLink {
  const [status, setStatus] = useState<LinkStatus>('off')
  const [detail, setDetail] = useState<string | undefined>()
  const [hostOnline, setHostOnline] = useState(false)
  const [state, setState] = useState<RemoteState | null>(null)
  const linkRef = useRef<RemoteLink | null>(null)

  useEffect(() => {
    if (!enabled || !room) {
      linkRef.current?.close()
      linkRef.current = null
      setStatus('off')
      return
    }

    const link = new RemoteLink({
      serverUrl,
      room,
      role: 'remote',
      name: 'mando',
      onStatus: (s, d) => {
        setStatus(s)
        setDetail(d)
        if (s === 'open') link.send({ t: 'hello' })
        if (s !== 'open') setHostOnline(false)
      },
      onMessage: (msg) => {
        switch (msg.t) {
          case 'state':
            setState((msg as { state: RemoteState }).state)
            setHostOnline(true)
            break
          case 'hello':
          case 'peers':
            setHostOnline(!!(msg as { hostOnline?: boolean }).hostOnline)
            break
          case 'error':
            setDetail((msg as { message: string }).message)
            if ((msg as { code: string }).code === 'no_host') setHostOnline(false)
            break
          default:
            break
        }
      },
    })
    linkRef.current = link
    link.connect()

    return () => {
      link.close()
      linkRef.current = null
    }
  }, [serverUrl, room, enabled])

  const send = useCallback((msg: RemoteMessage) => {
    linkRef.current?.send(msg)
  }, [])

  const reconnect = useCallback(() => {
    linkRef.current?.connect()
  }, [])

  return { status, detail, hostOnline, state, send, reconnect }
}
