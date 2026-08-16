import { useEffect, useRef } from 'react'
import { useStore } from './useStore'
import { eventKeyId, isTypingTarget, SWALLOW } from '../lib/keys'

type LearnHandler = ((code: string) => void) | null

let learnHandler: LearnHandler = null

/** Captura la siguiente tecla pulsada en vez de ejecutar su acción. */
export function captureNextKey(handler: LearnHandler) {
  learnHandler = handler
}

/**
 * Traduce las pulsaciones del mando Bluetooth (o del teclado) en acciones.
 * Vive en la raíz: así el mando también sirve en la biblioteca.
 */
export function useKeyRemote(): void {
  const lastFire = useRef(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const code = eventKeyId(e)

      if (learnHandler) {
        e.preventDefault()
        e.stopPropagation()
        const fn = learnHandler
        learnHandler = null
        fn(code)
        return
      }

      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const state = useStore.getState()
      const profile =
        state.settings.profiles.find((p) => p.id === state.settings.activeProfileId) ||
        state.settings.profiles[0]
      const binding = profile?.bindings.find((b) => b.code === code)

      if (!binding) {
        // Aun sin asignar, tragamos las teclas de scroll dentro del prompter
        // para que el navegador no mueva la página por su cuenta.
        if (state.view === 'prompter' && SWALLOW.has(code)) e.preventDefault()
        return
      }

      // Algunos pedales repiten la pulsación al mantenerla; 120 ms de guarda
      // evitan que un toque cuente como diez.
      const now = performance.now()
      if (e.repeat && now - lastFire.current < 120) {
        e.preventDefault()
        return
      }
      lastFire.current = now

      e.preventDefault()
      state.runAction(binding.action)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])
}

/**
 * Algunos mandos mandan teclas multimedia que el navegador no entrega como
 * `keydown`, pero sí como acciones de MediaSession. Para que el sistema nos
 * considere "reproductor activo" hace falta un audio en curso: usamos un tono
 * silencioso generado al vuelo.
 */
export function useMediaKeyRemote(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    if (!('mediaSession' in navigator)) return

    const audio = document.createElement('audio')
    audio.loop = true
    audio.volume = 0.0001
    // WAV de 0,2 s en silencio (mono, 8 kHz), suficiente para reclamar la sesión.
    audio.src =
      'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAACAgICAgICAgICAgICAgA=='

    const start = () => {
      void audio.play().catch(() => undefined)
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    // Los navegadores exigen un gesto del usuario antes de reproducir audio.
    window.addEventListener('pointerdown', start)
    window.addEventListener('keydown', start)

    const ms = navigator.mediaSession
    const set = (action: MediaSessionAction, fn: () => void) => {
      try {
        ms.setActionHandler(action, fn)
      } catch {
        /* acción no soportada en este navegador */
      }
    }
    set('play', () => useStore.getState().runAction('toggle'))
    set('pause', () => useStore.getState().runAction('toggle'))
    set('nexttrack', () => useStore.getState().runAction('speedUp'))
    set('previoustrack', () => useStore.getState().runAction('speedDown'))
    set('seekforward', () => useStore.getState().runAction('pageDown'))
    set('seekbackward', () => useStore.getState().runAction('pageUp'))

    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      audio.pause()
      audio.src = ''
      for (const a of [
        'play',
        'pause',
        'nexttrack',
        'previoustrack',
        'seekforward',
        'seekbackward',
      ] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(a, null)
        } catch {
          /* nada que limpiar */
        }
      }
    }
  }, [enabled])
}
