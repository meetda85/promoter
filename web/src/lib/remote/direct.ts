import { packCode, unpackCode, type Link, type LinkStatus } from './link'
import type { AnyMessage } from './protocol'

interface DirectOptions {
  onMessage: (msg: AnyMessage) => void
  onStatus: (status: LinkStatus, detail?: string) => void
}

interface SignalPayload {
  v: number
  t: 'o' | 'a'
  sdp: string
}

/**
 * Enlace punto a punto entre los dos teléfonos, sin servidor de por medio.
 *
 * El único momento en que hace falta un canal externo es el saludo inicial
 * (intercambiar las descripciones de sesión), y ese canal es la cámara: cada
 * lado enseña un QR y el otro lo lee.
 *
 * Sin servidores STUN configurados sólo se recogen candidatos locales, que es
 * justo lo que se quiere: funciona en una wifi sin salida a Internet o en el
 * punto de acceso de un teléfono. Si resulta que sí hay Internet se añade un
 * STUN público, que ayuda en redes donde los dos aparatos no se ven directos.
 */
export class DirectLink implements Link {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private opts: DirectOptions
  private lastPayload = ''
  private closed = false

  constructor(opts: DirectOptions) {
    this.opts = opts
  }

  get connected(): boolean {
    return !!this.dc && this.dc.readyState === 'open'
  }

  /** Lado teleprompter, paso 1: genera el código que se enseña como QR. */
  async createOffer(): Promise<string> {
    const pc = this.newConnection()
    this.bindChannel(pc.createDataChannel('promoter', { ordered: true }))
    await pc.setLocalDescription(await pc.createOffer())
    await waitForIce(pc)
    return packCode({ v: 1, t: 'o', sdp: pc.localDescription!.sdp })
  }

  /** Lado mando: lee el código del teleprompter y devuelve el suyo de vuelta. */
  async acceptOffer(code: string): Promise<string> {
    const data = await unpackCode<SignalPayload>(code)
    if (data.t !== 'o') throw new Error('Ese código no es el del teleprompter')

    const pc = this.newConnection()
    pc.ondatachannel = (e) => this.bindChannel(e.channel)
    await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
    await pc.setLocalDescription(await pc.createAnswer())
    await waitForIce(pc)
    return packCode({ v: 1, t: 'a', sdp: pc.localDescription!.sdp })
  }

  /** Lado teleprompter, paso 2: lee la respuesta del mando y queda enlazado. */
  async acceptAnswer(code: string): Promise<void> {
    const data = await unpackCode<SignalPayload>(code)
    if (data.t !== 'a') throw new Error('Ese código no es la respuesta del mando')
    if (!this.pc) throw new Error('Genera primero el código del teleprompter')
    await this.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
  }

  private newConnection(): RTCPeerConnection {
    this.closeConnection()
    this.closed = false
    const pc = new RTCPeerConnection({
      iceServers: navigator.onLine ? [{ urls: 'stun:stun.l.google.com:19302' }] : [],
    })
    pc.onconnectionstatechange = () => {
      if (this.closed) return
      if (pc.connectionState === 'failed') {
        this.opts.onStatus(
          'error',
          'No se pudo establecer el enlace directo. Comprueba que los dos aparatos están en la misma wifi.',
        )
      } else if (pc.connectionState === 'disconnected') {
        this.opts.onStatus('retrying', 'Enlace interrumpido')
      }
    }
    this.pc = pc
    this.opts.onStatus('connecting')
    return pc
  }

  private bindChannel(dc: RTCDataChannel): void {
    this.dc = dc
    dc.onopen = () => {
      this.lastPayload = ''
      this.opts.onStatus('open')
    }
    dc.onclose = () => {
      if (!this.closed) this.opts.onStatus('off')
    }
    dc.onmessage = (e) => {
      try {
        this.opts.onMessage(JSON.parse(String(e.data)) as AnyMessage)
      } catch {
        /* mensaje ilegible: se descarta */
      }
    }
  }

  send(msg: object): void {
    if (!this.connected) return
    this.dc!.send(JSON.stringify(msg))
  }

  sendIfChanged(msg: object): void {
    const payload = JSON.stringify(msg)
    if (payload === this.lastPayload) return
    this.lastPayload = payload
    if (this.connected) this.dc!.send(payload)
  }

  private closeConnection(): void {
    if (this.dc) {
      this.dc.onopen = this.dc.onclose = this.dc.onmessage = null
      try {
        this.dc.close()
      } catch {
        /* ya estaba cerrado */
      }
      this.dc = null
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null
      this.pc.ondatachannel = null
      try {
        this.pc.close()
      } catch {
        /* ya estaba cerrada */
      }
      this.pc = null
    }
  }

  close(): void {
    this.closed = true
    this.closeConnection()
    this.opts.onStatus('off')
  }
}

/**
 * Espera a tener todos los candidatos ICE para que el QR los lleve dentro y no
 * haga falta un segundo intercambio. Con tope de tiempo: en algunas redes el
 * navegador nunca da por cerrada la recolección.
 */
async function waitForIce(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}
