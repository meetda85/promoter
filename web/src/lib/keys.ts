/**
 * Los mandos Bluetooth de teleprompter (pedales, pasapáginas, disparadores de
 * selfies, clickers de presentación) se anuncian ante el sistema como teclados
 * HID. Para la app son, literalmente, pulsaciones de tecla.
 */

const PRETTY: Record<string, string> = {
  Space: 'Espacio',
  Enter: 'Intro',
  NumpadEnter: 'Intro (num)',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'Re Pág',
  PageDown: 'Av Pág',
  Home: 'Inicio',
  End: 'Fin',
  Equal: '+',
  Minus: '−',
  BracketLeft: '[',
  BracketRight: ']',
  Period: '.',
  Comma: ',',
  Backspace: 'Retroceso',
  Tab: 'Tab',
  AudioVolumeUp: 'Volumen +',
  AudioVolumeDown: 'Volumen −',
  MediaPlayPause: 'Play/Pausa multimedia',
  MediaTrackNext: 'Pista siguiente',
  MediaTrackPrevious: 'Pista anterior',
}

/** Identificador estable de una tecla; preferimos `code` por ser de layout fijo. */
export function eventKeyId(e: KeyboardEvent): string {
  if (e.code && e.code !== 'Unidentified' && e.code !== '') return e.code
  return e.key
}

export function prettyKey(code: string): string {
  if (PRETTY[code]) return PRETTY[code]
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad/.test(code)) return code.replace('Numpad', 'Num ')
  if (/^F\d{1,2}$/.test(code)) return code
  return code
}

/** No secuestres el teclado mientras alguien escribe su guion. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable === true
}

/** Teclas cuyo comportamiento por defecto estorba dentro del prompter. */
export const SWALLOW = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Enter',
])
