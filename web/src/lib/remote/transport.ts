import type { AnyMessage } from './protocol'
import { buildRelayUrl } from './protocol'
import type { Link, LinkStatus } from './link'

export type { LinkStatus }

export interface LinkOptions {
  serverUrl: string
  room: string
  role: 'host' | 'remote'
  name?: string
  /**
   * Reintentos antes de rendirse. Si la app está alojada en un sitio sin relay
   * (un hosting estático), insistir para siempre sólo gasta batería.
   */
  maxAttempts?: number
  onMessage: (msg: AnyMessage) => void
  onStatus: (status: LinkStatus, detail?: string) => void
}

/**
 * Cliente del relay con reconexión automática.
 *
 * En un rodaje la wifi se cae, el teléfono bloquea la pantalla y el navegador
 * suspende el socket. Reconectar en silencio es más importante que cualquier
 * otra cosa de esta clase.
 */
export class RemoteLink implements Link {
  private ws: WebSocket | null = null
  private opts: LinkOptions
  private attempts = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private closedByUs = false
  /** Último estado enviado, para no repetir tráfico idéntico. */
  private lastPayload = ''

  constructor(opts: LinkOptions) {
    this.opts = opts
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }

  connect(): void {
    this.closedByUs = false
    this.cleanupSocket()

    let url: string
    try {
      url = buildRelayUrl(this.opts.serverUrl, this.opts.room, this.opts.role, this.opts.name)
    } catch {
      this.opts.onStatus('error', 'La dirección del servidor no es válida')
      return
    }

    this.opts.onStatus(this.attempts ? 'retrying' : 'connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      this.scheduleRetry()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.attempts = 0
      this.lastPayload = ''
      this.opts.onStatus('open')
      this.heartbeat = setInterval(() => this.send({ t: 'ping', ts: Date.now() } as never), 25_000)
    }

    ws.onmessage = (ev) => {
      try {
        this.opts.onMessage(JSON.parse(String(ev.data)) as AnyMessage)
      } catch {
        /* mensaje ilegible: se descarta */
      }
    }

    ws.onerror = () => {
      this.opts.onStatus('error', 'No se pudo conectar con el servidor')
    }

    ws.onclose = () => {
      this.stopHeartbeat()
      if (this.closedByUs) {
        this.opts.onStatus('off')
        return
      }
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    this.attempts++
    const limit = this.opts.maxAttempts ?? Infinity
    if (this.attempts > limit) {
      this.opts.onStatus(
        'error',
        'No hay servidor de enlace en esta dirección. Indica uno en «Servidor» o usa un alojamiento que lo incluya.',
      )
      return
    }
    const delay = Math.min(15_000, 700 * 2 ** Math.min(this.attempts, 5))
    this.opts.onStatus('retrying', `Reintentando en ${Math.round(delay / 1000)} s`)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.connect(), delay)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private cleanupSocket(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.onopen = this.ws.onclose = this.ws.onerror = this.ws.onmessage = null
      try {
        this.ws.close()
      } catch {
        /* ya estaba cerrado */
      }
      this.ws = null
    }
  }

  send(msg: object): void {
    if (!this.connected) return
    this.ws!.send(JSON.stringify(msg))
  }

  /** Como `send`, pero se salta el envío si el contenido no ha cambiado. */
  sendIfChanged(msg: object): void {
    const payload = JSON.stringify(msg)
    if (payload === this.lastPayload) return
    this.lastPayload = payload
    if (this.connected) this.ws!.send(payload)
  }

  /** Reintento manual: vuelve a empezar la cuenta de intentos. */
  retryNow(): void {
    this.attempts = 0
    if (this.timer) clearTimeout(this.timer)
    this.connect()
  }

  close(): void {
    this.closedByUs = true
    if (this.timer) clearTimeout(this.timer)
    this.cleanupSocket()
    this.opts.onStatus('off')
  }

  update(opts: Partial<Pick<LinkOptions, 'serverUrl' | 'room' | 'name'>>): void {
    Object.assign(this.opts, opts)
  }
}
