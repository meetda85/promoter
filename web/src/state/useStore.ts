import { create } from 'zustand'
import type {
  ActionId,
  AppSettings,
  Marker,
  PlaybackStatus,
  PrompterSettings,
  Script,
} from '../lib/types'
import { DEFAULT_SETTINGS, BUILT_IN_PROFILES, makeRoomCode } from '../lib/defaults'
import { nextThemeId } from '../lib/themes'
import * as db from '../lib/db'
import { countWords, extractMarkers, htmlToText, newId } from '../lib/text'
import { sendPrompterCommand } from './bus'

export type View = 'library' | 'editor' | 'prompter' | 'remote'

export interface PlaybackInfo {
  progress: number // 0..1
  elapsed: number // s
  remaining: number // s
  total: number // s
  currentMarker: number
}

interface State {
  ready: boolean
  view: View
  scripts: Script[]
  currentId: string | null
  editingId: string | null
  settings: AppSettings
  status: PlaybackStatus
  countdownLeft: number
  info: PlaybackInfo
  markers: Marker[]
  controlsVisible: boolean
  toast: string | null

  init: () => Promise<void>
  setView: (v: View) => void
  setToast: (t: string | null) => void

  /* biblioteca */
  saveScript: (script: Script) => Promise<void>
  createScript: (partial?: Partial<Script>) => Promise<Script>
  removeScript: (id: string) => Promise<void>
  selectScript: (id: string | null) => void
  openPrompter: (id: string) => void
  openEditor: (id: string) => void

  /* ajustes */
  patchPrompter: (patch: Partial<PrompterSettings>) => void
  setSettingPath: (path: string, value: unknown) => void
  patchSettings: (patch: Partial<AppSettings>) => void
  resetPrompterSettings: () => void

  /* reproducción */
  play: () => void
  pause: () => void
  toggle: () => void
  stop: () => void
  restart: () => void
  setStatus: (s: PlaybackStatus) => void
  setCountdown: (n: number) => void
  setInfo: (info: Partial<PlaybackInfo>) => void
  setControlsVisible: (v: boolean) => void

  runAction: (action: ActionId) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persistSettings(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void db.saveSettings(settings)
  }, 400)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Aplica un patch a una ruta tipo `prompter.fontSize` sin mutar el original. */
function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.')
  const copy: any = { ...obj }
  let cursor = copy
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] = { ...cursor[parts[i]] }
    cursor = cursor[parts[i]]
  }
  cursor[parts[parts.length - 1]] = value
  return copy
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  view: 'library',
  scripts: [],
  currentId: null,
  editingId: null,
  settings: DEFAULT_SETTINGS,
  status: 'idle',
  countdownLeft: 0,
  info: { progress: 0, elapsed: 0, remaining: 0, total: 0, currentMarker: -1 },
  markers: [],
  controlsVisible: true,
  toast: null,

  async init() {
    const [scripts, stored] = await Promise.all([db.listScripts(), db.loadSettings()])
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      prompter: { ...DEFAULT_SETTINGS.prompter, ...(stored?.prompter || {}) },
      remote: { ...DEFAULT_SETTINGS.remote, ...(stored?.remote || {}) },
      drive: { ...DEFAULT_SETTINGS.drive, ...(stored?.drive || {}) },
      profiles: stored?.profiles?.length ? stored.profiles : BUILT_IN_PROFILES,
    }
    if (!settings.remote.room) settings.remote.room = makeRoomCode()

    set({ scripts, settings, ready: true })
    persistSettings(settings)
  },

  setView(view) {
    set({ view })
  },

  setToast(toast) {
    set({ toast })
    if (toast) setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : s)), 2600)
  },

  async saveScript(script) {
    const text = htmlToText(script.html)
    const full: Script = {
      ...script,
      text,
      wordCount: countWords(text),
      updatedAt: Date.now(),
    }
    await db.putScript(full)
    set((s) => {
      const rest = s.scripts.filter((x) => x.id !== full.id)
      return {
        scripts: [full, ...rest].sort((a, b) => b.updatedAt - a.updatedAt),
        markers: s.currentId === full.id ? extractMarkers(full.html) : s.markers,
      }
    })
  },

  async createScript(partial) {
    const now = Date.now()
    const html = partial?.html || '<p></p>'
    const text = partial?.text ?? htmlToText(html)
    const script: Script = {
      id: partial?.id || newId(),
      title: partial?.title || 'Guion sin título',
      html,
      text,
      wordCount: countWords(text),
      source: partial?.source || 'manual',
      sourceRef: partial?.sourceRef,
      createdAt: now,
      updatedAt: now,
    }
    await db.putScript(script)
    set((s) => ({ scripts: [script, ...s.scripts] }))
    return script
  },

  async removeScript(id) {
    await db.deleteScript(id)
    set((s) => ({
      scripts: s.scripts.filter((x) => x.id !== id),
      currentId: s.currentId === id ? null : s.currentId,
    }))
  },

  selectScript(id) {
    const script = get().scripts.find((s) => s.id === id)
    set({ currentId: id, markers: script ? extractMarkers(script.html) : [] })
  },

  openPrompter(id) {
    get().selectScript(id)
    set({
      view: 'prompter',
      status: 'idle',
      controlsVisible: true,
      info: { progress: 0, elapsed: 0, remaining: 0, total: 0, currentMarker: -1 },
    })
  },

  openEditor(id) {
    set({ editingId: id, view: 'editor' })
  },

  patchPrompter(patch) {
    set((s) => {
      const settings = { ...s.settings, prompter: { ...s.settings.prompter, ...patch } }
      persistSettings(settings)
      return { settings }
    })
  },

  setSettingPath(path, value) {
    set((s) => {
      const settings = setByPath(s.settings, path, value)
      persistSettings(settings)
      return { settings }
    })
  },

  patchSettings(patch) {
    set((s) => {
      const settings = { ...s.settings, ...patch }
      persistSettings(settings)
      return { settings }
    })
  },

  resetPrompterSettings() {
    set((s) => {
      const settings = { ...s.settings, prompter: { ...DEFAULT_SETTINGS.prompter } }
      persistSettings(settings)
      return { settings }
    })
  },

  play() {
    const { status, settings } = get()
    if (status === 'playing') return
    if (status === 'paused') {
      set({ status: 'playing' })
      return
    }
    const countdown = settings.prompter.countdown
    if (countdown > 0) set({ status: 'countdown', countdownLeft: countdown })
    else set({ status: 'playing' })
  },

  pause() {
    const { status } = get()
    if (status === 'playing' || status === 'countdown') set({ status: 'paused', countdownLeft: 0 })
  },

  toggle() {
    const { status } = get()
    if (status === 'playing' || status === 'countdown') get().pause()
    else get().play()
  },

  stop() {
    set({ status: 'idle', countdownLeft: 0, controlsVisible: true })
  },

  restart() {
    sendPrompterCommand({ type: 'restart' })
    set({ status: 'idle', countdownLeft: 0 })
  },

  setStatus(status) {
    set({ status })
  },

  setCountdown(countdownLeft) {
    set({ countdownLeft })
  },

  setInfo(patch) {
    set((s) => ({ info: { ...s.info, ...patch } }))
  },

  setControlsVisible(controlsVisible) {
    set({ controlsVisible })
  },

  runAction(action) {
    const s = get()
    const p = s.settings.prompter
    switch (action) {
      case 'play':
        s.play()
        break
      case 'pause':
        s.pause()
        break
      case 'toggle':
        s.toggle()
        break
      case 'stop':
        s.stop()
        break
      case 'restart':
        s.restart()
        break
      case 'speedUp':
        if (p.speedUnit === 'wpm') s.patchPrompter({ wpm: clamp(p.wpm + 5, 40, 400) })
        else s.patchPrompter({ speed: clamp(p.speed + 2, 1, 100) })
        break
      case 'speedDown':
        if (p.speedUnit === 'wpm') s.patchPrompter({ wpm: clamp(p.wpm - 5, 40, 400) })
        else s.patchPrompter({ speed: clamp(p.speed - 2, 1, 100) })
        break
      case 'fontUp':
        s.patchPrompter({ fontSize: clamp(p.fontSize + 4, 16, 240) })
        break
      case 'fontDown':
        s.patchPrompter({ fontSize: clamp(p.fontSize - 4, 16, 240) })
        break
      case 'scrollUp':
        sendPrompterCommand({ type: 'scrollBy', px: -p.fontSize * p.lineHeight })
        break
      case 'scrollDown':
        sendPrompterCommand({ type: 'scrollBy', px: p.fontSize * p.lineHeight })
        break
      case 'pageUp':
        sendPrompterCommand({ type: 'page', dir: -1 })
        break
      case 'pageDown':
        sendPrompterCommand({ type: 'page', dir: 1 })
        break
      case 'markerNext':
        sendPrompterCommand({ type: 'marker', dir: 1 })
        break
      case 'markerPrev':
        sendPrompterCommand({ type: 'marker', dir: -1 })
        break
      case 'mirrorH':
        s.patchPrompter({ mirrorH: !p.mirrorH })
        break
      case 'mirrorV':
        s.patchPrompter({ mirrorV: !p.mirrorV })
        break
      case 'themeNext':
        s.patchPrompter({ theme: nextThemeId(p.theme) })
        break
      case 'toggleControls':
        set({ controlsVisible: !s.controlsVisible })
        break
      case 'library':
        set({ view: 'library', status: 'idle', controlsVisible: true })
        break
      case 'nextScript':
      case 'prevScript': {
        const list = s.scripts
        if (!list.length) break
        const i = Math.max(
          0,
          list.findIndex((x) => x.id === s.currentId),
        )
        const next = list[(i + (action === 'nextScript' ? 1 : -1) + list.length) % list.length]
        s.openPrompter(next.id)
        break
      }
      case 'fullscreen':
        sendPrompterCommand({ type: 'fullscreen' })
        break
    }
  },
}))
