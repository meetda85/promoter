import type { ActionId, Marker, PlaybackStatus, PrompterSettings } from '../types'
import type { PlaybackInfo, View } from '../../state/useStore'

export interface RemoteScriptSummary {
  id: string
  title: string
  wordCount: number
}

/** Foto completa del prompter, para que el mando pinte el mismo menú. */
export interface RemoteState {
  scripts: RemoteScriptSummary[]
  currentId: string | null
  currentTitle: string
  status: PlaybackStatus
  countdownLeft: number
  info: PlaybackInfo
  markers: Marker[]
  prompter: PrompterSettings
  view: View
  controlsVisible: boolean
}

export type HostMessage =
  | { t: 'state'; state: RemoteState }
  | { t: 'pong'; ts: number }

export type RemoteMessage =
  | { t: 'hello' }
  | { t: 'action'; action: ActionId }
  | { t: 'set'; path: string; value: unknown }
  | { t: 'select'; id: string }
  | { t: 'view'; view: View }
  | { t: 'seek'; ratio: number }
  | { t: 'jumpMarker'; index: number }

/** Mensajes que añade el propio relay. */
export type ServerMessage =
  | { t: 'hello'; peerId: string; role: 'host' | 'remote'; room: string; hostOnline: boolean; remotes: number }
  | { t: 'peers'; hostOnline: boolean; remotes: number }
  | { t: 'error'; code: string; message: string }

export type AnyMessage = (HostMessage | RemoteMessage | ServerMessage) & {
  from?: 'host' | 'remote'
  peerId?: string
}

/**
 * Normaliza lo que el usuario escriba en el campo "servidor": acepta
 * `192.168.1.20`, `192.168.1.20:8080`, `http://…` o `ws://…`.
 */
export function buildRelayUrl(serverUrl: string, room: string, role: 'host' | 'remote', name = ''): string {
  const params = `room=${encodeURIComponent(room)}&role=${role}&name=${encodeURIComponent(name)}`
  const raw = serverUrl.trim()

  if (!raw) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}/ws?${params}`
  }

  let normalized = raw
  if (!/^[a-z]+:\/\//i.test(normalized)) normalized = `ws://${normalized}`
  normalized = normalized.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')

  const url = new URL(normalized)
  if (!url.pathname || url.pathname === '/') url.pathname = '/ws'
  return `${url.origin}${url.pathname}?${params}`
}
