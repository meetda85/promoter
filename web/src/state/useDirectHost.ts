import { create } from 'zustand'
import { DirectLink } from '../lib/remote/direct'
import type { LinkStatus } from '../lib/remote/link'
import { handleHostMessage, registerHostLink, snapshot } from './hostBridge'

interface DirectHostState {
  status: LinkStatus
  detail?: string
  /** Código que se enseña como QR mientras se espera la respuesta del mando. */
  offerCode: string | null
  busy: boolean
  error: string | null
  start: () => Promise<void>
  finish: (answerCode: string) => Promise<void>
  stop: () => void
}

let link: DirectLink | null = null
let unregister: (() => void) | null = null

/**
 * Emparejamiento directo desde el teleprompter: genera el código, espera la
 * respuesta del mando y deja el canal abierto. No necesita servidor ni
 * Internet: los dos aparatos hablan entre ellos por la red local.
 */
export const useDirectHost = create<DirectHostState>((set) => ({
  status: 'off',
  offerCode: null,
  busy: false,
  error: null,

  async start() {
    set({ busy: true, error: null, offerCode: null })
    try {
      link?.close()
      unregister?.()
      link = new DirectLink({
        onStatus: (status, detail) => set({ status, detail }),
        onMessage: (msg) =>
          handleHostMessage(msg, () => link?.send({ t: 'state', state: snapshot() })),
      })
      unregister = registerHostLink(link)
      const code = await link.createOffer()
      set({ offerCode: code, busy: false })
    } catch (e) {
      set({ busy: false, error: (e as Error).message, status: 'error' })
    }
  },

  async finish(answerCode) {
    if (!link) {
      set({ error: 'Genera primero el código del teleprompter' })
      return
    }
    set({ busy: true, error: null })
    try {
      await link.acceptAnswer(answerCode)
      set({ busy: false })
    } catch (e) {
      set({ busy: false, error: (e as Error).message })
    }
  },

  stop() {
    link?.close()
    unregister?.()
    link = null
    unregister = null
    set({ status: 'off', offerCode: null, error: null, busy: false })
  },
}))
