import type { Marker } from './types'

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Las notas no se leen en voz alta: no deben contar para la duración.
  doc.querySelectorAll('[data-note="true"], .pm-note').forEach((el) => el.remove())
  doc.querySelectorAll('p, h1, h2, h3, li, br, div').forEach((el) => el.after('\n'))
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Convierte texto plano en HTML respetando párrafos y líneas sueltas. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (!blocks.length) return '<p></p>'
  return blocks
    .map((block) => {
      // Una línea corta en MAYÚSCULAS suele ser un rótulo de sección.
      if (
        block.length < 60 &&
        !block.includes('\n') &&
        block === block.toUpperCase() &&
        /[A-ZÁÉÍÓÚÑ]/.test(block)
      ) {
        return `<h2>${escape(block)}</h2>`
      }
      return `<p>${escape(block).replace(/\n/g, '<br />')}</p>`
    })
    .join('')
}

export function extractMarkers(html: string): Marker[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = Array.from(doc.querySelectorAll('h1, h2, h3'))
  return nodes.map((el, i) => ({
    id: `m${i}`,
    label: (el.textContent || `Marcador ${i + 1}`).trim().slice(0, 60),
    level: Number(el.tagName.slice(1)),
  }))
}

export function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0
  const s = Math.floor(totalSeconds % 60)
  const m = Math.floor((totalSeconds / 60) % 60)
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Velocidad de scroll en px/s.
 *
 * En modo `scale` la referencia es la altura de línea, para que cambiar el
 * tamaño de letra no cambie el ritmo de lectura. En modo `wpm` se calcula a
 * partir de la densidad real de palabras del texto ya maquetado.
 */
export function scrollPxPerSecond(opts: {
  speedUnit: 'scale' | 'wpm'
  speed: number
  wpm: number
  fontSize: number
  lineHeight: number
  contentHeight: number
  wordCount: number
}): number {
  if (opts.speedUnit === 'wpm' && opts.wordCount > 0 && opts.contentHeight > 0) {
    const pxPerWord = opts.contentHeight / opts.wordCount
    return (opts.wpm / 60) * pxPerWord
  }
  const linePx = Math.max(1, opts.fontSize * opts.lineHeight)
  const linesPerMinute = Math.max(0, opts.speed) * 1.2
  return (linesPerMinute / 60) * linePx
}

export function estimateSeconds(opts: { pxPerSecond: number; scrollableHeight: number }): number {
  if (opts.pxPerSecond <= 0) return 0
  return opts.scrollableHeight / opts.pxPerSecond
}

export function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
