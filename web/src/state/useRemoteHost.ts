import { useEffect, useRef, useState } from 'react'
import { useStore } from './useStore'
import { sendPrompterCommand } from './bus'
import { RemoteLink, type LinkStatus } from '../lib/remote/transport'
import type { AnyMessage, RemoteState } from '../lib/remote/protocol'
import type { ActionId } from '../lib/types'

export interface HostLinkInfo {
  status: LinkStatus
  detail?: string
  remotes: number
}

/**
 * Lado teleprompter del enlace: publica su estado y obedece al mando.
 *
 * Se monta una sola vez en la raíz de la app para que el mando pueda navegar
 * por el menú aunque el prompter esté en la biblioteca o en el editor.
 */
export function useRemoteHost(enabled = true): HostLinkInfo {
  const room = useStore((s) => s.settings.remote.room)
  const serverUrl = useStore((s) => s.settings.remote.serverUrl)
  const autoConnect = useStore((s) => s.settings.remote.autoConnect)
  const ready = useStore((s) => s.ready)

  const [info, setInfo] = useState<HostLinkInfo>({ status: 'off', remotes: 0 })
  const linkRef = useRef<RemoteLink | null>(null)

  useEffect(() => {
    if (!ready || !enabled || !autoConnect || !room) {
      linkRef.current?.close()
      linkRef.current = null
      setInfo({ status: 'off', remotes: 0 })
      return
    }

    const link: RemoteLink = new RemoteLink({
      serverUrl,
      room,
      role: 'host',
      name: 'teleprompter',
      onStatus: (status, detail) => setInfo((prev) => ({ ...prev, status, detail })),
      onMessage: (msg) => {
        if (msg.t === 'peers' || (msg.t === 'hello' && msg.from === undefined)) {
          const remotes = (msg as { remotes?: number }).remotes
          if (typeof remotes === 'number') setInfo((prev) => ({ ...prev, remotes }))
        }
        handleMessage(msg, () => link.send({ t: 'state', state: snapshot() }))
      },
    })
    linkRef.current = link
    link.connect()

    // Empuja el estado a los mandos a 5 Hz. Suficiente para que la barra de
    // progreso se vea viva sin inundar la red.
    const push = setInterval(() => {
      if (!link.connected) return
      link.sendIfChanged({ t: 'state', state: snapshot() })
    }, 200)

    return () => {
      clearInterval(push)
      link.close()
      linkRef.current = null
    }
  }, [ready, enabled, autoConnect, room, serverUrl])

  return info
}

function snapshot(): RemoteState {
  const s = useStore.getState()
  const current = s.scripts.find((x) => x.id === s.currentId) || null
  return {
    scripts: s.scripts.map((x) => ({ id: x.id, title: x.title, wordCount: x.wordCount })),
    currentId: s.currentId,
    currentTitle: current?.title || '',
    status: s.status,
    countdownLeft: s.countdownLeft,
    info: s.info,
    markers: s.markers,
    prompter: s.settings.prompter,
    view: s.view,
    controlsVisible: s.controlsVisible,
  }
}

function handleMessage(msg: AnyMessage, replyState: () => void) {
  const store = useStore.getState()
  switch (msg.t) {
    case 'hello':
      // Puede ser el saludo del relay o el de un mando que acaba de entrar:
      // en ambos casos lo correcto es reenviar el estado completo.
      replyState()
      break
    case 'action':
      store.runAction((msg as { action: ActionId }).action)
      replyState()
      break
    case 'set':
      store.setSettingPath((msg as { path: string }).path, (msg as { value: unknown }).value)
      break
    case 'select': {
      const id = (msg as { id: string }).id
      store.openPrompter(id)
      break
    }
    case 'view':
      store.setView((msg as { view: 'library' | 'editor' | 'prompter' | 'remote' }).view)
      break
    case 'seek':
      sendPrompterCommand({ type: 'jumpRatio', ratio: (msg as { ratio: number }).ratio })
      break
    case 'jumpMarker':
      sendPrompterCommand({ type: 'jumpMarker', index: (msg as { index: number }).index })
      break
    default:
      break
  }
}
