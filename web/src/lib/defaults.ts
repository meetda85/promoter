import type { AppSettings, RemoteProfile } from './types'

export const FONT_STACKS: { id: string; name: string; stack: string }[] = [
  {
    id: 'system',
    name: 'Sistema',
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { id: 'grotesk', name: 'Grotesca', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'serif', name: 'Serif', stack: 'Georgia, "Times New Roman", Times, serif' },
  { id: 'slab', name: 'Slab', stack: '"Rockwell", "Courier Bold", Georgia, serif' },
  {
    id: 'mono',
    name: 'Monoespaciada',
    stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
  {
    id: 'rounded',
    name: 'Redondeada',
    stack: '"SF Pro Rounded", "Varela Round", Verdana, sans-serif',
  },
]

/** Genera un código de sala corto y legible en voz alta. */
export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin I, O, 0, 1
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/**
 * Perfiles de mando listos para usar. Casi todos los mandos Bluetooth de
 * fotografía/pasapáginas se anuncian como teclado HID y envían estas teclas.
 */
export const BUILT_IN_PROFILES: RemoteProfile[] = [
  {
    id: 'universal',
    name: 'Universal (recomendado)',
    builtIn: true,
    bindings: [
      { code: 'Space', action: 'toggle', label: 'Play / Pausa' },
      { code: 'Enter', action: 'toggle', label: 'Play / Pausa' },
      { code: 'ArrowUp', action: 'speedUp', label: 'Más rápido' },
      { code: 'ArrowDown', action: 'speedDown', label: 'Más lento' },
      { code: 'ArrowRight', action: 'pageDown', label: 'Avanzar' },
      { code: 'ArrowLeft', action: 'pageUp', label: 'Retroceder' },
      { code: 'PageDown', action: 'pageDown', label: 'Avanzar' },
      { code: 'PageUp', action: 'pageUp', label: 'Retroceder' },
      { code: 'KeyR', action: 'restart', label: 'Reiniciar' },
      { code: 'KeyM', action: 'mirrorH', label: 'Espejo' },
      { code: 'KeyF', action: 'fullscreen', label: 'Pantalla completa' },
      { code: 'KeyC', action: 'themeNext', label: 'Cambiar contraste' },
      { code: 'KeyH', action: 'toggleControls', label: 'Ocultar controles' },
      { code: 'Escape', action: 'library', label: 'Volver a la biblioteca' },
      { code: 'Equal', action: 'fontUp', label: 'Letra más grande' },
      { code: 'Minus', action: 'fontDown', label: 'Letra más pequeña' },
      { code: 'BracketRight', action: 'markerNext', label: 'Siguiente marcador' },
      { code: 'BracketLeft', action: 'markerPrev', label: 'Marcador anterior' },
    ],
  },
  {
    id: 'pedal2',
    name: 'Pedal / mando de 2 botones',
    builtIn: true,
    bindings: [
      { code: 'ArrowUp', action: 'toggle', label: 'Play / Pausa' },
      { code: 'ArrowDown', action: 'restart', label: 'Reiniciar' },
      { code: 'Space', action: 'toggle', label: 'Play / Pausa' },
      { code: 'Enter', action: 'toggle', label: 'Play / Pausa' },
    ],
  },
  {
    id: 'shutter',
    name: 'Disparador de selfies / obturador',
    builtIn: true,
    // Los disparadores baratos mandan Volumen+ (que iOS traduce a Espacio o Enter)
    // o directamente la tecla de subir volumen en Android.
    bindings: [
      { code: 'Space', action: 'toggle', label: 'Play / Pausa' },
      { code: 'Enter', action: 'toggle', label: 'Play / Pausa' },
      { code: 'AudioVolumeUp', action: 'toggle', label: 'Play / Pausa' },
      { code: 'AudioVolumeDown', action: 'pause', label: 'Pausa' },
    ],
  },
  {
    id: 'presenter',
    name: 'Puntero de presentaciones',
    builtIn: true,
    bindings: [
      { code: 'PageDown', action: 'toggle', label: 'Play / Pausa' },
      { code: 'PageUp', action: 'restart', label: 'Reiniciar' },
      { code: 'Period', action: 'toggleControls', label: 'Ocultar controles' },
      { code: 'Escape', action: 'library', label: 'Biblioteca' },
    ],
  },
]

export const DEFAULT_SETTINGS: AppSettings = {
  prompter: {
    fontFamily: FONT_STACKS[0].stack,
    fontSize: 64,
    lineHeight: 1.45,
    letterSpacing: 0,
    fontWeight: 600,
    textAlign: 'center',
    contentWidth: 88,
    paddingTop: 45,

    speed: 28,
    speedUnit: 'scale',
    wpm: 140,
    smoothing: 0.25,
    countdown: 3,
    loop: false,

    mirrorH: false,
    mirrorV: false,
    theme: 'classic',
    customBg: '#000000',
    customFg: '#ffffff',
    brightness: 1,
    bgDim: 0,

    focusStyle: 'arrows',
    focusPosition: 0.42,
    showProgress: true,
    showTimer: true,
    showRemaining: true,
    hideNotes: true,

    keepAwake: true,
    fullscreenOnPlay: false,
    tapToToggle: true,
    hideControlsDelay: 2500,
  },
  remote: {
    mode: 'relay',
    room: '',
    serverUrl: '',
    autoConnect: true,
    mediaKeys: false,
  },
  drive: {
    clientId: '',
  },
  activeProfileId: 'universal',
  profiles: BUILT_IN_PROFILES,
}

export const ACTION_LABELS: Record<string, string> = {
  play: 'Reproducir',
  pause: 'Pausar',
  toggle: 'Play / Pausa',
  stop: 'Detener',
  restart: 'Volver al principio',
  speedUp: 'Más rápido',
  speedDown: 'Más lento',
  fontUp: 'Letra más grande',
  fontDown: 'Letra más pequeña',
  scrollUp: 'Subir un poco',
  scrollDown: 'Bajar un poco',
  pageUp: 'Retroceder una pantalla',
  pageDown: 'Avanzar una pantalla',
  markerNext: 'Siguiente marcador',
  markerPrev: 'Marcador anterior',
  mirrorH: 'Espejo horizontal',
  mirrorV: 'Espejo vertical',
  themeNext: 'Siguiente contraste',
  toggleControls: 'Mostrar / ocultar controles',
  library: 'Volver a la biblioteca',
  nextScript: 'Siguiente guion',
  prevScript: 'Guion anterior',
  fullscreen: 'Pantalla completa',
}
