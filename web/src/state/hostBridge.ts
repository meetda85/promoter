import { useStore } from './useStore'
import { sendPrompterCommand } from './bus'
import type { Link } from '../lib/remote/link'
import type { AnyMessage, RemoteState } from '../lib/remote/protocol'
import type { ActionId } from '../lib/types'
import type { View } from './useStore'

/**
 * Lado teleprompter del mando, independiente del transporte.
 *
 * Aquí no importa si el mando llegó por el relay o por el enlace directo: los
 * dos hablan el mismo idioma y los dos pueden estar activos a la vez.
 */

const links = new Set<Link>()

export function registerHostLink(link: Link): () => void {
  links.add(link)
  return () => {
    links.delete(link)
  }
}

/** Foto del estado actual para que el mando pinte el mismo menú. */
export function snapshot(): RemoteState {
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

/** Empuja el estado a todos los mandos conectados, por el transporte que sea. */
export function broadcastState(): void {
  for (const link of links) {
    if (link.connected) link.sendIfChanged({ t: 'state', state: snapshot() })
  }
}

export function handleHostMessage(msg: AnyMessage, replyState: () => void): void {
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
    case 'select':
      store.openPrompter((msg as { id: string }).id)
      break
    case 'view':
      store.setView((msg as { view: View }).view)
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
