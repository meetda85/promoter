/**
 * Canal imperativo entre el estado global y el motor de scroll del prompter.
 *
 * La posición del scroll no vive en el store: cambia 60 veces por segundo y
 * re-renderizar React a ese ritmo sería absurdo. El store publica órdenes aquí
 * y el componente del prompter las ejecuta sobre el DOM.
 */
export type PrompterCommand =
  | { type: 'scrollBy'; px: number }
  | { type: 'page'; dir: 1 | -1 }
  | { type: 'marker'; dir: 1 | -1 }
  | { type: 'jumpRatio'; ratio: number }
  | { type: 'jumpMarker'; index: number }
  | { type: 'restart' }
  | { type: 'fullscreen' }

type Listener = (cmd: PrompterCommand) => void

const listeners = new Set<Listener>()

export function onPrompterCommand(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function sendPrompterCommand(cmd: PrompterCommand): void {
  for (const fn of listeners) fn(cmd)
}
