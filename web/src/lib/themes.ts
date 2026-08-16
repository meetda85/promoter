import type { Theme, ThemeId } from './types'

/**
 * Presets de contraste. No es sólo blanco sobre negro: cada uno está pensado
 * para una situación real (sol directo, plató oscuro, cristal espejado, etc.).
 */
export const THEMES: Theme[] = [
  { id: 'classic', name: 'Clásico', bg: '#000000', fg: '#ffffff', accent: '#ffb02e' },
  { id: 'inverted', name: 'Papel', bg: '#f6f6f4', fg: '#101014', accent: '#ffd54a' },
  { id: 'amber', name: 'Ámbar', bg: '#000000', fg: '#ffb02e', accent: '#ff6b3d' },
  { id: 'highYellow', name: 'Alto contraste', bg: '#000000', fg: '#ffe600', accent: '#00e5ff' },
  { id: 'terminal', name: 'Verde fósforo', bg: '#04120a', fg: '#5dff9f', accent: '#ffe600' },
  { id: 'cyan', name: 'Azul noche', bg: '#04101f', fg: '#8fdcff', accent: '#ffb02e' },
  { id: 'sepia', name: 'Sepia', bg: '#241a10', fg: '#f2dfc4', accent: '#ff9f45' },
  { id: 'nightDim', name: 'Nocturno suave', bg: '#000000', fg: '#9aa0a6', accent: '#c58aff' },
  { id: 'ultra', name: 'Ultra contraste', bg: '#000000', fg: '#ffffff', accent: '#ff2d55' },
  { id: 'custom', name: 'Personalizado', bg: '#000000', fg: '#ffffff', accent: '#ffb02e' },
]

export function themeById(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

export function nextThemeId(id: ThemeId): ThemeId {
  const list = THEMES.filter((t) => t.id !== 'custom')
  const i = list.findIndex((t) => t.id === id)
  return list[(i + 1) % list.length].id
}

/** Paleta compartida por el editor y los selectores de color. */
export const TEXT_COLORS = [
  '#ffffff',
  '#ffe600',
  '#ffb02e',
  '#ff6b3d',
  '#ff2d55',
  '#c58aff',
  '#5dff9f',
  '#8fdcff',
  '#9aa0a6',
  '#101014',
]

export const HIGHLIGHT_COLORS = [
  '#ffe600',
  '#ffb02e',
  '#ff2d55',
  '#c58aff',
  '#5dff9f',
  '#8fdcff',
  '#ffffff',
  '#3a3a44',
  '#1f1f26',
]
