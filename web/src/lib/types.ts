export type ScriptSource = 'manual' | 'local' | 'drive' | 'paste'

export interface Marker {
  id: string
  label: string
  level: number
}

export interface Script {
  id: string
  title: string
  /** HTML enriquecido del editor: colores, resaltados, notas, tamaños. */
  html: string
  /** Texto plano, para contar palabras y estimar duración. */
  text: string
  wordCount: number
  source: ScriptSource
  /** Referencia al origen (id de Drive, nombre del archivo…). */
  sourceRef?: string
  folder?: string
  createdAt: number
  updatedAt: number
}

export type ThemeId =
  | 'classic'
  | 'inverted'
  | 'amber'
  | 'highYellow'
  | 'terminal'
  | 'cyan'
  | 'sepia'
  | 'nightDim'
  | 'ultra'
  | 'custom'

export interface Theme {
  id: ThemeId
  name: string
  bg: string
  fg: string
  /** Color por defecto del resaltado cuando se escribe sobre este fondo. */
  accent: string
}

export type FocusStyle = 'none' | 'line' | 'arrows' | 'both' | 'band'

export interface PrompterSettings {
  /* tipografía */
  fontFamily: string
  fontSize: number // px
  lineHeight: number // múltiplo
  letterSpacing: number // px
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
  contentWidth: number // % del ancho de pantalla
  paddingTop: number // % de alto, para que el texto no arranque pegado

  /* movimiento */
  speed: number // 1..100 (escala propia, ver scrollPxPerSecond)
  speedUnit: 'scale' | 'wpm'
  wpm: number // usado cuando speedUnit === 'wpm'
  smoothing: number // 0..1, suavizado de los cambios de velocidad
  countdown: number // segundos de cuenta atrás antes de arrancar
  loop: boolean

  /* imagen */
  mirrorH: boolean
  mirrorV: boolean
  /** Giro de la imagen en grados, para el teléfono montado de lado. */
  rotation: 0 | 90 | 180 | 270
  theme: ThemeId
  customBg: string
  customFg: string
  brightness: number // 0.2..1 atenuación del texto
  bgDim: number // 0..1 oscurecer el fondo

  /* ayudas de lectura */
  focusStyle: FocusStyle
  focusPosition: number // 0..1 alto de pantalla donde está la línea de lectura
  showProgress: boolean
  showTimer: boolean
  showRemaining: boolean
  hideNotes: boolean

  /* sistema */
  keepAwake: boolean
  fullscreenOnPlay: boolean
  tapToToggle: boolean
  hideControlsDelay: number // ms
}

export interface RemoteSettings {
  /**
   * Cómo se enlaza el teléfono-mando: `relay` pasa por un servidor y `direct`
   * conecta los dos aparatos entre sí por la red local, sin servidor.
   */
  mode: 'relay' | 'direct'
  /** Código de sala usado para emparejar con el teléfono-mando. */
  room: string
  /** URL del relay; vacío = el mismo servidor desde el que se abrió la app. */
  serverUrl: string
  autoConnect: boolean
  /** Intenta capturar teclas multimedia / de volumen del mando Bluetooth. */
  mediaKeys: boolean
}

/** Acciones que puede disparar cualquier mando (Bluetooth o de red). */
export type ActionId =
  | 'play'
  | 'pause'
  | 'toggle'
  | 'stop'
  | 'restart'
  | 'speedUp'
  | 'speedDown'
  | 'fontUp'
  | 'fontDown'
  | 'scrollUp'
  | 'scrollDown'
  | 'pageUp'
  | 'pageDown'
  | 'markerNext'
  | 'markerPrev'
  | 'mirrorH'
  | 'mirrorV'
  | 'rotateNext'
  | 'themeNext'
  | 'toggleControls'
  | 'library'
  | 'nextScript'
  | 'prevScript'
  | 'fullscreen'

export interface KeyBinding {
  /** `KeyboardEvent.code` cuando existe; si no, `key`. */
  code: string
  action: ActionId
  label?: string
}

export interface RemoteProfile {
  id: string
  name: string
  bindings: KeyBinding[]
  builtIn?: boolean
}

export interface DriveSettings {
  clientId: string
  /** Se guarda sólo en memoria de sesión; nunca se persiste en disco. */
  connectedEmail?: string
}

export interface AppSettings {
  prompter: PrompterSettings
  remote: RemoteSettings
  drive: DriveSettings
  activeProfileId: string
  profiles: RemoteProfile[]
}

export type PlaybackStatus = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'
