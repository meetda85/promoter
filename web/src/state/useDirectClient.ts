import { create } from 'zustand'
import { DirectLink } from '../lib/remote/direct'
import type { LinkStatus } from '../lib/remote/link'
import type { RemoteMessage, RemoteState } from '../lib/remote/protocol'

interface DirectClientState {
  status: LinkStatus
  detail?: string
  /** Código de respuesta que el teleprompter tiene que escanear. */
  answerCode: string | null
  state: RemoteState | null
  busy: boolean
  error: string | null
  accept: (offerCode: string) => Promise<void>
  send: (msg: RemoteMessage) => void
  stop: () => void
}

let link: DirectLink | null = null

/** Lado mando del enlace directo. */
export const useDirectClient = create<DirectClientState>((set, get) => ({
  status: 'off',
  answerCode: null,
  state: null,
  busy: false,
  error: null,

  async accept(offerCode) {
    set({ busy: true, error: null, answerCode: null })
    try {
      link?.close()
      link = new DirectLink({
        onStatus: (status, detail) => {
          set({ status, detail })
          if (status === 'open') get().send({ t: 'hello' })
        },
        onMessage: (msg) => {
          if (msg.t === 'state') set({ state: (msg as { state: RemoteState }).state })
        },
      })
      const code = await link.acceptOffer(offerCode)
      set({ answerCode: code, busy: false })
    } catch (e) {
      set({ busy: false, error: (e as Error).message, status: 'error' })
    }
  },

  send(msg) {
    link?.send(msg)
  },

  stop() {
    link?.close()
    link = null
    set({ status: 'off', answerCode: null, state: null, error: null, busy: false })
  },
}))
