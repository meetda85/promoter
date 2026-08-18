import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/useStore'
import { onPrompterCommand, sendPrompterCommand } from '../state/bus'
import { themeById } from '../lib/themes'
import { formatTime, scrollPxPerSecond } from '../lib/text'
import { ControlPanel, type Controller } from './ControlPanel'
import { Sheet } from './ui'

/** Marca de tiempo de la última interacción, para el auto-ocultado del HUD. */
function useAutoHideControls(active: boolean, delay: number) {
  const visible = useStore((s) => s.controlsVisible)
  const setVisible = useStore((s) => s.setControlsVisible)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poke = useCallback(() => {
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    if (active && delay > 0) timer.current = setTimeout(() => setVisible(false), delay)
  }, [active, delay, setVisible])

  useEffect(() => {
    poke()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [poke])

  return { visible, poke }
}

export function Prompter() {
  const script = useStore((s) => s.scripts.find((x) => x.id === s.currentId) || null)
  const p = useStore((s) => s.settings.prompter)
  const status = useStore((s) => s.status)
  const countdownLeft = useStore((s) => s.countdownLeft)
  const markers = useStore((s) => s.markers)
  const info = useStore((s) => s.info)
  const scripts = useStore((s) => s.scripts)
  const currentId = useStore((s) => s.currentId)

  const [panel, setPanel] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  /** Posición de lectura en px. Fuera de React a propósito. */
  const offset = useRef(0)
  const speedNow = useRef(0)
  const metrics = useRef({ view: 0, content: 0, text: 0, max: 0 })
  const markerTops = useRef<number[]>([])
  const elapsed = useRef(0)

  const theme = useMemo(() => {
    const t = themeById(p.theme)
    return p.theme === 'custom' ? { ...t, bg: p.customBg, fg: p.customFg } : t
  }, [p.theme, p.customBg, p.customFg])

  const { visible: controlsVisible, poke } = useAutoHideControls(
    status === 'playing',
    p.hideControlsDelay,
  )

  /* ------------------------------------------------------------ medidas */

  const measure = useCallback(() => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root || !content) return
    const view = root.clientHeight
    const contentH = content.scrollHeight
    const padTop = (p.paddingTop / 100) * view
    const padBottom = view * 0.6
    metrics.current = {
      view,
      content: contentH,
      text: Math.max(1, contentH - padTop - padBottom),
      max: Math.max(1, contentH - view),
    }
    markerTops.current = Array.from(content.querySelectorAll('h1, h2, h3')).map(
      (el) => (el as HTMLElement).offsetTop,
    )
  }, [p.paddingTop])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => measure())
    if (contentRef.current) ro.observe(contentRef.current)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('orientationchange', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', measure)
    }
  }, [measure, script?.html])

  /* ------------------------------------------------------ bucle de scroll */

  const apply = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    content.style.transform = `translate3d(0, ${-offset.current}px, 0)`
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastReport = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now

      const store = useStore.getState()
      const s = store.settings.prompter
      const playing = store.status === 'playing'

      const target = playing
        ? scrollPxPerSecond({
            speedUnit: s.speedUnit,
            speed: s.speed,
            wpm: s.wpm,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            contentHeight: metrics.current.text,
            wordCount: store.scripts.find((x) => x.id === store.currentId)?.wordCount || 0,
          })
        : 0

      // Suavizado exponencial: los cambios de ritmo no dan tirones en cámara.
      const k = s.smoothing <= 0 ? 1 : 1 - Math.exp(-dt / (s.smoothing * 0.6))
      speedNow.current += (target - speedNow.current) * k

      if (playing) {
        elapsed.current += dt
        offset.current += speedNow.current * dt
        if (offset.current >= metrics.current.max) {
          if (s.loop) {
            offset.current = 0
            elapsed.current = 0
          } else {
            offset.current = metrics.current.max
            store.setStatus('finished')
            store.setControlsVisible(true)
          }
        }
      } else if (Math.abs(speedNow.current) > 0.5) {
        // Frenada suave al pausar, como una cinta que se detiene.
        offset.current = Math.min(metrics.current.max, offset.current + speedNow.current * dt)
      }

      apply()

      if (now - lastReport > 180) {
        lastReport = now
        const progress = metrics.current.max > 0 ? offset.current / metrics.current.max : 0
        const pxPerSec = Math.max(
          1,
          scrollPxPerSecond({
            speedUnit: s.speedUnit,
            speed: s.speed,
            wpm: s.wpm,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            contentHeight: metrics.current.text,
            wordCount: store.scripts.find((x) => x.id === store.currentId)?.wordCount || 0,
          }),
        )
        const remaining = (metrics.current.max - offset.current) / pxPerSec
        const focusY = metrics.current.view * s.focusPosition
        let currentMarker = -1
        for (let i = 0; i < markerTops.current.length; i++) {
          if (markerTops.current[i] - offset.current <= focusY) currentMarker = i
        }
        store.setInfo({
          progress: Math.max(0, Math.min(1, progress)),
          elapsed: elapsed.current,
          remaining: Math.max(0, remaining),
          total: metrics.current.max / pxPerSec,
          currentMarker,
        })
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  /* ---------------------------------------------------------- cuenta atrás */

  useEffect(() => {
    if (status !== 'countdown') return
    const store = useStore.getState()
    const tick = setInterval(() => {
      const left = useStore.getState().countdownLeft - 1
      if (left <= 0) {
        clearInterval(tick)
        store.setCountdown(0)
        store.setStatus('playing')
      } else {
        store.setCountdown(left)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [status])

  /* -------------------------------------------------------------- órdenes */

  useEffect(
    () =>
      onPrompterCommand((cmd) => {
        const m = metrics.current
        const clamp = (v: number) => Math.max(0, Math.min(m.max, v))
        switch (cmd.type) {
          case 'scrollBy':
            offset.current = clamp(offset.current + cmd.px)
            break
          case 'page':
            offset.current = clamp(offset.current + cmd.dir * m.view * 0.8)
            break
          case 'jumpRatio':
            offset.current = clamp(cmd.ratio * m.max)
            break
          case 'restart':
            offset.current = 0
            elapsed.current = 0
            speedNow.current = 0
            break
          case 'marker': {
            const focusY = m.view * useStore.getState().settings.prompter.focusPosition
            const tops = markerTops.current
            const target =
              cmd.dir > 0
                ? tops.find((t) => t - offset.current > focusY + 4)
                : [...tops].reverse().find((t) => t - offset.current < focusY - 4)
            if (target !== undefined) offset.current = clamp(target - focusY)
            break
          }
          case 'jumpMarker': {
            const focusY = m.view * useStore.getState().settings.prompter.focusPosition
            const top = markerTops.current[cmd.index]
            if (top !== undefined) offset.current = clamp(top - focusY)
            break
          }
          case 'fullscreen':
            void toggleFullscreen()
            break
        }
        apply()
      }),
    [apply],
  )

  /* ------------------------------------------------------ pantalla activa */

  useEffect(() => {
    if (!p.keepAwake) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        /* el navegador puede negarlo: no es crítico */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
    }
  }, [p.keepAwake])

  useEffect(() => {
    if (status === 'playing' && p.fullscreenOnPlay && !document.fullscreenElement) {
      void toggleFullscreen()
    }
  }, [status, p.fullscreenOnPlay])

  /* ------------------------------------------------------------- gestos */

  const drag = useRef<{ id: number; y: number; startOffset: number; moved: boolean } | null>(null)
  const pinch = useRef<{ dist: number; size: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const onPointerDown = (e: React.PointerEvent) => {
    poke()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), size: p.fontSize }
      drag.current = null
      return
    }
    drag.current = { id: e.pointerId, y: e.clientY, startOffset: offset.current, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const ratio = dist / pinch.current.dist
      const size = Math.round(Math.max(16, Math.min(240, pinch.current.size * ratio)))
      if (size !== p.fontSize) useStore.getState().patchPrompter({ fontSize: size })
      return
    }

    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 6) d.moved = true
    if (d.moved) {
      const dir = p.mirrorV ? -1 : 1
      offset.current = Math.max(0, Math.min(metrics.current.max, d.startOffset - dy * dir))
      apply()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    if (panel) return
    if (p.tapToToggle) useStore.getState().toggle()
    else poke()
  }

  /* ------------------------------------------------------------ controlador */

  const controller: Controller = {
    settings: p,
    status,
    info,
    markers,
    scripts: scripts.map((s) => ({ id: s.id, title: s.title, wordCount: s.wordCount })),
    currentId,
    action: (a) => useStore.getState().runAction(a),
    set: (path, value) => useStore.getState().setSettingPath(path, value),
    select: (id) => {
      useStore.getState().openPrompter(id)
      setPanel(false)
    },
    seek: (ratio) => sendPrompterCommand({ type: 'jumpRatio', ratio }),
    jumpMarker: (index) => sendPrompterCommand({ type: 'jumpMarker', index }),
  }

  const playing = status === 'playing' || status === 'countdown'
  const focusY = `${p.focusPosition * 100}%`

  return (
    <div
      ref={rootRef}
      className="prompter"
      data-hide-notes={p.hideNotes}
      style={
        {
          '--pm-bg': theme.bg,
          '--pm-fg': theme.fg,
          '--pm-accent': theme.accent,
          '--pm-brightness': p.brightness,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="prompter-scroll"
        style={{
          transform: `scale(${p.mirrorH ? -1 : 1}, ${p.mirrorV ? -1 : 1})`,
        }}
      >
        <div
          ref={contentRef}
          className="prompter-content"
          style={{
            width: `${p.contentWidth}%`,
            paddingTop: `${p.paddingTop}vh`,
            fontFamily: p.fontFamily,
            fontSize: p.fontSize,
            lineHeight: p.lineHeight,
            letterSpacing: p.letterSpacing,
            fontWeight: p.fontWeight,
            textAlign: p.textAlign,
          }}
          dangerouslySetInnerHTML={{ __html: script?.html || '<p>Sin guion seleccionado.</p>' }}
        />
      </div>

      {p.bgDim > 0 && <div className="prompter-dim" style={{ opacity: p.bgDim }} />}

      {(p.focusStyle === 'line' || p.focusStyle === 'both') && (
        <div className="focus-line" style={{ top: focusY }} />
      )}
      {p.focusStyle === 'band' && (
        <div
          className="focus-band"
          style={{
            top: `calc(${focusY} - ${p.fontSize * p.lineHeight * 0.7}px)`,
            height: p.fontSize * p.lineHeight * 1.4,
          }}
        />
      )}
      {(p.focusStyle === 'arrows' || p.focusStyle === 'both') && (
        <>
          <div className="cue-arrow left" style={{ top: `calc(${focusY} - 14px)` }} />
          <div className="cue-arrow right" style={{ top: `calc(${focusY} - 14px)` }} />
        </>
      )}

      {status === 'countdown' && <div className="countdown">{countdownLeft}</div>}

      <div className="hud top" data-visible={controlsVisible}>
        <button
          className="pill"
          onClick={(e) => {
            e.stopPropagation()
            useStore.getState().setView('library')
            useStore.getState().stop()
          }}
        >
          ☰ Biblioteca
        </button>
        <div className="grow" />
        {p.showTimer && <span className="pill">{formatTime(info.elapsed)}</span>}
        {p.showRemaining && <span className="pill">−{formatTime(info.remaining)}</span>}
        <button
          className="pill"
          onClick={(e) => {
            e.stopPropagation()
            setPanel(true)
          }}
        >
          ⚙
        </button>
      </div>

      <div className="hud bottom" data-visible={controlsVisible}>
        {p.showProgress && (
          <div className="progress">
            <div style={{ width: `${info.progress * 100}%` }} />
          </div>
        )}
        <div className="transport" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="pill"
            onClick={() => useStore.getState().runAction('restart')}
            aria-label="Volver al principio"
          >
            ⏮
          </button>
          <button
            className="pill"
            onClick={() => useStore.getState().runAction('speedDown')}
            aria-label="Más lento"
          >
            −
          </button>
          <button
            className="pill play"
            onClick={() => useStore.getState().toggle()}
            aria-label={playing ? 'Pausa' : 'Reproducir'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            className="pill"
            onClick={() => useStore.getState().runAction('speedUp')}
            aria-label="Más rápido"
          >
            +
          </button>
          <button
            className="pill"
            onClick={() => useStore.getState().runAction('mirrorH')}
            aria-label="Espejo"
            style={{ opacity: p.mirrorH ? 1 : 0.65 }}
          >
            ⇄
          </button>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="pill">
            {p.speedUnit === 'wpm' ? `${p.wpm} ppm` : `Ritmo ${p.speed}`} · {p.fontSize} px
          </span>
        </div>
      </div>

      {panel && (
        <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <Sheet title="Controles" onClose={() => setPanel(false)}>
            <ControlPanel c={controller} />
          </Sheet>
        </div>
      )}
    </div>
  )
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    /* iOS Safari no permite pantalla completa fuera de un vídeo */
  }
}
