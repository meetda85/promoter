import { useStore } from './useStore'
import { sendPrompterCommand } from './bus'
import type { Link } from '../lib/remote/link'
import type { AnyMessage, RemoteScriptDoc, RemoteState } from '../lib/remote/protocol'
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

/**
 * Atiende un mensaje del mando.
 *
 * `reply` manda algo de vuelta sólo a quien preguntó; `replyState` reenvía el
 * estado completo. La edición a distancia usa el primero: el guion es grande y
 * no tiene sentido difundirlo a todos los mandos. Ninguno tiene valor por
 * defecto a propósito: confundirlos hace que el guion nunca llegue.
 */
export function handleHostMessage(
  msg: AnyMessage,
  replyState: () => void,
  reply: (payload: object) => void,
): void {
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

    case 'getScript': {
      const id = (msg as { id: string }).id
      const found = store.scripts.find((x) => x.id === id)
      const script: RemoteScriptDoc | null = found
        ? { id: found.id, title: found.title, html: found.html }
        : null
      reply({ t: 'script', script })
      break
    }

    case 'saveScript': {
      const { id, title, html } = msg as { id: string; title: string; html: string }
      const found = store.scripts.find((x) => x.id === id)
      if (!found) break
      void store.saveScript({ ...found, title, html })
      break
    }

    case 'newScript':
      void store.createScript({ title: 'Guion sin título' }).then((created) => {
        reply({ t: 'script', script: { id: created.id, title: created.title, html: created.html } })
        replyState()
      })
      break

    case 'deleteScript':
      void store.removeScript((msg as { id: string }).id).then(replyState)
      break

    default:
      break
  }
}
