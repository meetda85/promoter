import { useState } from 'react'
import type { ActionId, Marker, PlaybackStatus, PrompterSettings } from '../lib/types'
import type { PlaybackInfo } from '../state/useStore'
import type { RemoteScriptSummary } from '../lib/remote/protocol'
import { FONT_STACKS } from '../lib/defaults'
import { THEMES } from '../lib/themes'
import { formatTime } from '../lib/text'
import { Segmented, Slider, ToggleRow } from './ui'

/**
 * Superficie de control única.
 *
 * La usa tanto el panel de ajustes del propio teleprompter como el teléfono
 * que hace de mando: así el remoto tiene *exactamente* el mismo menú, sin
 * duplicar lógica ni quedarse atrás cuando se añade un ajuste.
 */
export interface Controller {
  settings: PrompterSettings
  status: PlaybackStatus
  info: PlaybackInfo
  markers: Marker[]
  scripts: RemoteScriptSummary[]
  currentId: string | null
  action: (a: ActionId) => void
  set: (path: string, value: unknown) => void
  select: (id: string) => void
  seek: (ratio: number) => void
  jumpMarker: (index: number) => void
}

type Tab = 'play' | 'text' | 'look' | 'read' | 'scripts'

const TABS: { value: Tab; label: string }[] = [
  { value: 'play', label: 'Marcha' },
  { value: 'text', label: 'Texto' },
  { value: 'look', label: 'Color' },
  { value: 'read', label: 'Lectura' },
  { value: 'scripts', label: 'Guiones' },
]

export function ControlPanel({
  c,
  initialTab = 'play',
  showTransport = true,
}: {
  c: Controller
  initialTab?: Tab
  showTransport?: boolean
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const p = c.settings
  const playing = c.status === 'playing' || c.status === 'countdown'

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'play' && (
        <>
          {showTransport && (
            <>
              <button
                className="btn primary wide big-play"
                onClick={() => c.action('toggle')}
                style={{ marginBottom: 10 }}
              >
                {playing ? '❚❚  Pausa' : '▶  Reproducir'}
              </button>
              <div className="remote-transport" style={{ marginBottom: 14 }}>
                <button className="btn" onClick={() => c.action('restart')} title="Al principio">
                  ⏮
                </button>
                <button className="btn" onClick={() => c.action('pageUp')} title="Retroceder">
                  ⤒
                </button>
                <button className="btn" onClick={() => c.action('pageDown')} title="Avanzar">
                  ⤓
                </button>
                <button className="btn" onClick={() => c.action('library')} title="Biblioteca">
                  ☰
                </button>
              </div>
            </>
          )}

          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="muted">Transcurrido {formatTime(c.info.elapsed)}</span>
              <span className="muted">Faltan {formatTime(c.info.remaining)}</span>
            </div>
            <input
              className="slider"
              type="range"
              min={0}
              max={1000}
              value={Math.round(c.info.progress * 1000)}
              onChange={(e) => c.seek(Number(e.target.value) / 1000)}
              aria-label="Posición en el guion"
            />
          </div>

          <div className="section-title">Velocidad</div>
          <div className="card">
            <div style={{ marginBottom: 12 }}>
              <Segmented
                options={[
                  { value: 'scale', label: 'Manual' },
                  { value: 'wpm', label: 'Palabras/min' },
                ]}
                value={p.speedUnit}
                onChange={(v) => c.set('prompter.speedUnit', v)}
              />
            </div>
            {p.speedUnit === 'scale' ? (
              <Slider
                label="Ritmo"
                value={p.speed}
                min={1}
                max={100}
                onChange={(v) => c.set('prompter.speed', v)}
              />
            ) : (
              <Slider
                label="Palabras por minuto"
                value={p.wpm}
                min={40}
                max={400}
                step={5}
                onChange={(v) => c.set('prompter.wpm', v)}
              />
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn grow" onClick={() => c.action('speedDown')}>
                − Más lento
              </button>
              <button className="btn grow" onClick={() => c.action('speedUp')}>
                Más rápido +
              </button>
            </div>
          </div>

          <div className="section-title">Arranque</div>
          <div className="card">
            <Slider
              label="Cuenta atrás"
              value={p.countdown}
              min={0}
              max={10}
              onChange={(v) => c.set('prompter.countdown', v)}
              format={(v) => (v === 0 ? 'sin cuenta atrás' : `${v} s`)}
            />
            <ToggleRow
              label="Repetir en bucle"
              hint="Al llegar al final vuelve al principio"
              checked={p.loop}
              onChange={(v) => c.set('prompter.loop', v)}
            />
            <ToggleRow
              label="Pantalla completa al reproducir"
              checked={p.fullscreenOnPlay}
              onChange={(v) => c.set('prompter.fullscreenOnPlay', v)}
            />
            <ToggleRow
              label="Mantener la pantalla encendida"
              checked={p.keepAwake}
              onChange={(v) => c.set('prompter.keepAwake', v)}
            />
            <ToggleRow
              label="Tocar la pantalla para pausar"
              checked={p.tapToToggle}
              onChange={(v) => c.set('prompter.tapToToggle', v)}
            />
          </div>
        </>
      )}

      {tab === 'text' && (
        <>
          <div className="card">
            <div className="field">
              <label>Tipografía</label>
              <select
                className="input"
                value={p.fontFamily}
                onChange={(e) => c.set('prompter.fontFamily', e.target.value)}
              >
                {FONT_STACKS.map((f) => (
                  <option key={f.id} value={f.stack}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <Slider
              label="Tamaño de letra"
              value={p.fontSize}
              min={16}
              max={240}
              onChange={(v) => c.set('prompter.fontSize', v)}
              suffix=" px"
            />
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <button className="btn grow" onClick={() => c.action('fontDown')}>
                A−
              </button>
              <button className="btn grow" onClick={() => c.action('fontUp')}>
                A+
              </button>
            </div>
            <Slider
              label="Interlineado"
              value={p.lineHeight}
              min={1}
              max={2.6}
              step={0.05}
              onChange={(v) => c.set('prompter.lineHeight', v)}
            />
            <Slider
              label="Espaciado entre letras"
              value={p.letterSpacing}
              min={-2}
              max={12}
              step={0.5}
              onChange={(v) => c.set('prompter.letterSpacing', v)}
              suffix=" px"
            />
            <Slider
              label="Grosor"
              value={p.fontWeight}
              min={300}
              max={900}
              step={100}
              onChange={(v) => c.set('prompter.fontWeight', v)}
            />
            <Slider
              label="Ancho del texto"
              value={p.contentWidth}
              min={40}
              max={100}
              onChange={(v) => c.set('prompter.contentWidth', v)}
              suffix=" %"
            />
            <div className="field">
              <label>Alineación</label>
              <Segmented
                options={[
                  { value: 'left', label: 'Izquierda' },
                  { value: 'center', label: 'Centro' },
                  { value: 'right', label: 'Derecha' },
                ]}
                value={p.textAlign}
                onChange={(v) => c.set('prompter.textAlign', v)}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'look' && (
        <>
          <div className="section-title">Contraste</div>
          <div className="card">
            <div className="swatches" style={{ gap: 10 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => c.set('prompter.theme', t.id)}
                  className="swatch"
                  data-on={p.theme === t.id}
                  title={t.name}
                  aria-label={t.name}
                  style={{
                    width: 54,
                    height: 44,
                    background: t.id === 'custom' ? p.customBg : t.bg,
                    color: t.id === 'custom' ? p.customFg : t.fg,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 17,
                  }}
                >
                  Aa
                </button>
              ))}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {THEMES.find((t) => t.id === p.theme)?.name}
            </div>

            {p.theme === 'custom' && (
              <div className="row" style={{ gap: 12, marginTop: 12 }}>
                <div className="field grow">
                  <label>Fondo</label>
                  <input
                    className="input"
                    type="color"
                    value={p.customBg}
                    onChange={(e) => c.set('prompter.customBg', e.target.value)}
                  />
                </div>
                <div className="field grow">
                  <label>Texto</label>
                  <input
                    className="input"
                    type="color"
                    value={p.customFg}
                    onChange={(e) => c.set('prompter.customFg', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <Slider
                label="Intensidad del texto"
                value={p.brightness}
                min={0.25}
                max={1}
                step={0.05}
                onChange={(v) => c.set('prompter.brightness', v)}
                format={(v) => `${Math.round(v * 100)} %`}
              />
              <Slider
                label="Oscurecer el fondo"
                value={p.bgDim}
                min={0}
                max={0.85}
                step={0.05}
                onChange={(v) => c.set('prompter.bgDim', v)}
                format={(v) => `${Math.round(v * 100)} %`}
              />
            </div>
          </div>

          <div className="section-title">Espejo</div>
          <div className="card">
            <ToggleRow
              label="Espejo horizontal"
              hint="Para cristal de teleprompter (beam splitter)"
              checked={p.mirrorH}
              onChange={(v) => c.set('prompter.mirrorH', v)}
            />
            <ToggleRow
              label="Espejo vertical"
              hint="Cuando la cámara mira desde arriba"
              checked={p.mirrorV}
              onChange={(v) => c.set('prompter.mirrorV', v)}
            />
          </div>
        </>
      )}

      {tab === 'read' && (
        <>
          <div className="card">
            <div className="field">
              <label>Guía de lectura</label>
              <Segmented
                options={[
                  { value: 'none', label: 'Nada' },
                  { value: 'line', label: 'Línea' },
                  { value: 'arrows', label: 'Flechas' },
                  { value: 'both', label: 'Ambas' },
                  { value: 'band', label: 'Franja' },
                ]}
                value={p.focusStyle}
                onChange={(v) => c.set('prompter.focusStyle', v)}
              />
            </div>
            <Slider
              label="Altura de la guía"
              value={p.focusPosition}
              min={0.1}
              max={0.85}
              step={0.01}
              onChange={(v) => c.set('prompter.focusPosition', v)}
              format={(v) => `${Math.round(v * 100)} % de la pantalla`}
            />
            <Slider
              label="Margen superior del texto"
              value={p.paddingTop}
              min={0}
              max={80}
              onChange={(v) => c.set('prompter.paddingTop', v)}
              suffix=" %"
            />
            <ToggleRow
              label="Barra de progreso"
              checked={p.showProgress}
              onChange={(v) => c.set('prompter.showProgress', v)}
            />
            <ToggleRow
              label="Tiempo transcurrido"
              checked={p.showTimer}
              onChange={(v) => c.set('prompter.showTimer', v)}
            />
            <ToggleRow
              label="Tiempo restante"
              checked={p.showRemaining}
              onChange={(v) => c.set('prompter.showRemaining', v)}
            />
            <ToggleRow
              label="Ocultar notas"
              hint="Las notas del guion no se muestran al leer"
              checked={p.hideNotes}
              onChange={(v) => c.set('prompter.hideNotes', v)}
            />
          </div>

          {c.markers.length > 0 && (
            <>
              <div className="section-title">Marcadores</div>
              <div className="card">
                {c.markers.map((m, i) => (
                  <button
                    key={m.id}
                    className="btn wide"
                    style={{
                      justifyContent: 'flex-start',
                      marginBottom: 6,
                      paddingLeft: 12 + (m.level - 1) * 12,
                      borderColor: c.info.currentMarker === i ? 'var(--accent)' : undefined,
                    }}
                    onClick={() => c.jumpMarker(i)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'scripts' && (
        <div className="card">
          {c.scripts.length === 0 && <div className="muted">No hay guiones todavía.</div>}
          {c.scripts.map((s) => (
            <button
              key={s.id}
              className="btn wide"
              style={{
                justifyContent: 'space-between',
                marginBottom: 8,
                borderColor: s.id === c.currentId ? 'var(--accent)' : undefined,
              }}
              onClick={() => c.select(s.id)}
            >
              <span
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {s.title}
              </span>
              <span className="muted">{s.wordCount} pal.</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
