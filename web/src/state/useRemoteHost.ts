import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from './useStore'
import { RemoteLink } from '../lib/remote/transport'
import type { LinkStatus } from '../lib/remote/link'
import { broadcastState, handleHostMessage, registerHostLink, snapshot } from './hostBridge'

export interface HostLinkInfo {
  status: LinkStatus
  detail?: string
  remotes: number
  /** Reintento manual tras agotar los automáticos. */
  retry: () => void
}

/**
 * Lado teleprompter del enlace por relay: publica su estado y obedece al mando.
 *
 * Se monta una sola vez en la raíz de la app para que el mando pueda navegar
 * por el menú aunque el prompter esté en la biblioteca o en el editor. El
 * intervalo de difusión que arranca aquí sirve también al enlace directo.
 */
export function useRemoteHost(enabled = true): HostLinkInfo {
  const room = useStore((s) => s.settings.remote.room)
  const serverUrl = useStore((s) => s.settings.remote.serverUrl)
  const autoConnect = useStore((s) => s.settings.remote.autoConnect)
  const ready = useStore((s) => s.ready)

  const linkRef = useRef<RemoteLink | null>(null)
  const retry = useCallback(() => linkRef.current?.retryNow(), [])
  const [info, setInfo] = useState<HostLinkInfo>({ status: 'off', remotes: 0, retry })

  // Un único latido difunde el estado por todos los transportes activos, a
  // 5 Hz: suficiente para que la barra de progreso del mando se vea viva.
  useEffect(() => {
    if (!ready) return
    const push = setInterval(broadcastState, 200)
    return () => clearInterval(push)
  }, [ready])

  useEffect(() => {
    if (!ready || !enabled || !autoConnect || !room) {
      linkRef.current?.close()
      linkRef.current = null
      setInfo({ status: 'off', remotes: 0, retry })
      return
    }

    const link: RemoteLink = new RemoteLink({
      serverUrl,
      room,
      role: 'host',
      name: 'teleprompter',
      maxAttempts: 6,
      onStatus: (status, detail) => setInfo((prev) => ({ ...prev, status, detail })),
      onMessage: (msg) => {
        if (msg.t === 'peers' || (msg.t === 'hello' && msg.from === undefined)) {
          const remotes = (msg as { remotes?: number }).remotes
          if (typeof remotes === 'number') setInfo((prev) => ({ ...prev, remotes }))
        }
        handleHostMessage(
          msg,
          () => link.send({ t: 'state', state: snapshot() }),
          // El guion completo se manda sólo al mando que lo pidió.
          (payload) => link.send({ ...payload, to: msg.peerId }),
        )
      },
    })
    linkRef.current = link
    const unregister = registerHostLink(link)
    link.connect()

    return () => {
      unregister()
      link.close()
      linkRef.current = null
    }
  }, [ready, enabled, autoConnect, room, serverUrl, retry])

  return info
}
