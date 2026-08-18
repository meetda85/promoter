import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import { useRemoteClient } from '../state/useRemoteClient'
import { useDirectClient } from '../state/useDirectClient'
import { ControlPanel, type Controller } from './ControlPanel'
import { QrCode } from './QrCode'
import { QrScanner } from './QrScanner'
import { formatTime } from '../lib/text'
import type { ActionId } from '../lib/types'
import type { RemoteMessage, RemoteState } from '../lib/remote/protocol'
import type { LinkStatus } from '../lib/remote/link'

function tap() {
  try {
    navigator.vibrate?.(12)
  } catch {
    /* sin vibración: da igual */
  }
}

/** Lee `#/remote?room=XXXX` para que el QR del relay conecte sin escribir nada. */
function roomFromHash(): { room: string; server: string } {
  const hash = location.hash.replace(/^#/, '')
  const qIndex = hash.indexOf('?')
  if (qIndex < 0) return { room: '', server: '' }
  const params = new URLSearchParams(hash.slice(qIndex + 1))
  return { room: (params.get('room') || '').toUpperCase(), server: params.get('server') || '' }
}

type Mode = 'choose' | 'relay' | 'direct'

export function RemoteControl() {
  const setView = useStore((s) => s.setView)
  const stored = useStore((s) => s.settings.remote)
  const setSettingPath = useStore((s) => s.setSettingPath)

  const fromHash = useMemo(roomFromHash, [])
  const [mode, setMode] = useState<Mode>(fromHash.room ? 'relay' : 'choose')
  const [room, setRoom] = useState(fromHash.room || stored.room || '')
  const [server, setServer] = useState(fromHash.server || stored.serverUrl || '')
  const [draftRoom, setDraftRoom] = useState(room)
  const [draftServer, setDraftServer] = useState(server)
  const [scanning, setScanning] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  const relay = useRemoteClient(server, room, mode === 'relay')
  const direct = useDirectClient()

  // Mantener la pantalla del mando encendida evita perder el enlace a mitad de toma.
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          sentinel = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* opcional */
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release().catch(() => undefined)
    }
  }, [])

  // Al salir del mando se sueltan los recursos del enlace directo.
  useEffect(() => () => useDirectClient.getState().stop(), [])

  const live: {
    status: LinkStatus
    detail?: string
    state: RemoteState | null
    hostOnline: boolean
    send: (msg: RemoteMessage) => void
    retry?: () => void
  } =
    mode === 'direct'
      ? {
          status: direct.status,
          detail: direct.detail || direct.error || undefined,
          state: direct.state,
          hostOnline: direct.status === 'open',
          send: direct.send,
        }
      : {
          status: relay.status,
          detail: relay.detail,
          state: relay.state,
          hostOnline: relay.hostOnline,
          send: relay.send,
          retry: relay.reconnect,
        }

  const state = live.state
  const controller: Controller | null = state && {
    settings: state.prompter,
    status: state.status,
    info: state.info,
    markers: state.markers,
    scripts: state.scripts,
    currentId: state.currentId,
    action: (a: ActionId) => {
      tap()
      live.send({ t: 'action', action: a })
    },
    set: (path, value) => live.send({ t: 'set', path, value }),
    select: (id) => {
      tap()
      live.send({ t: 'select', id })
    },
    seek: (ratio) => live.send({ t: 'seek', ratio }),
    jumpMarker: (index) => live.send({ t: 'jumpMarker', index }),
  }

  const back = (
    <button
      className="btn ghost icon"
      onClick={() => {
        useDirectClient.getState().stop()
        setView('library')
      }}
      aria-label="Volver"
    >
      ‹
    </button>
  )

  /* ---------------------------------------------------------- elección */

  if (mode === 'choose') {
    return (
      <div className="app">
        <div className="topbar">
          {back}
          <h1>Usar como mando</h1>
        </div>
        <div className="scroll-area">
          <button
            className="btn primary wide big"
            style={{ marginBottom: 10 }}
            onClick={() => {
              setMode('direct')
              setScanning(true)
            }}
          >
            📷 Escanear el código del teleprompter
          </button>
          <div className="muted" style={{ marginBottom: 20 }}>
            Sirve para los dos modos de enlace. Si el teleprompter está en «Directo, sin internet»,
            os conectáis sin servidor y sin necesidad de que la wifi tenga Internet.
          </div>

          <div className="section-title">O escribe el código de sala</div>
          <div className="card">
            <div className="field">
              <label>Código de la sala</label>
              <input
                className="input"
                value={draftRoom}
                onChange={(e) =>
                  setDraftRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect="off"
                style={{
                  fontSize: 26,
                  letterSpacing: '0.18em',
                  textAlign: 'center',
                  fontWeight: 800,
                }}
              />
            </div>
            <div className="field">
              <label>Servidor (opcional)</label>
              <input
                className="input"
                value={draftServer}
                onChange={(e) => setDraftServer(e.target.value)}
                placeholder="192.168.1.20:8080"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <button
              className="btn wide big"
              disabled={draftRoom.length < 4}
              onClick={() => {
                setRoom(draftRoom)
                setServer(draftServer.trim())
                setSettingPath('remote.serverUrl', draftServer.trim())
                setMode('relay')
              }}
            >
              Conectar
            </button>
          </div>
        </div>

        {scanning && (
          <QrScanner
            title="Escanea el código del teleprompter"
            hint="Está en Ajustes → Mando de red del otro teléfono"
            onClose={() => {
              setScanning(false)
              setMode('direct')
            }}
            onResult={(text) => {
              setScanning(false)
              // El QR del relay es una URL; el del enlace directo, un código propio.
              if (/^https?:\/\//i.test(text)) {
                try {
                  const url = new URL(text)
                  const params = new URLSearchParams(url.hash.split('?')[1] || '')
                  const scanned = (params.get('room') || '').toUpperCase()
                  if (scanned) {
                    setRoom(scanned)
                    setServer(url.host)
                    setSettingPath('remote.serverUrl', url.host)
                    setMode('relay')
                    return
                  }
                } catch {
                  /* no era una URL usable */
                }
                setMode('choose')
                return
              }
              void useDirectClient.getState().accept(text)
              setMode('direct')
            }}
          />
        )}
      </div>
    )
  }

  /* ------------------------------------------- enlace directo a medias */

  if (mode === 'direct' && direct.status !== 'open') {
    return (
      <div className="app">
        <div className="topbar">
          {back}
          <h1>Enlace directo</h1>
        </div>
        <div className="scroll-area">
          {direct.busy && (
            <div className="card row">
              <span className="spinner" />
              <span className="muted">Preparando el enlace…</span>
            </div>
          )}

          {direct.answerCode && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="chip" data-tone="warn" style={{ marginBottom: 12 }}>
                <span className="dot" />
                Falta el último paso
              </div>
              <QrCode value={direct.answerCode} />
              <div className="muted" style={{ marginTop: 10 }}>
                Enseña este código al teleprompter y púlsale «Escanear la respuesta del mando».
              </div>
              <button
                className="btn wide"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(direct.answerCode || '')
                    useStore.getState().setToast('Código copiado')
                  } catch {
                    setPasting(true)
                  }
                }}
              >
                Copiar el código
              </button>
            </div>
          )}

          {direct.error && (
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              {direct.error}
            </div>
          )}

          {!direct.answerCode && !direct.busy && (
            <>
              <button
                className="btn primary wide big"
                style={{ marginBottom: 10 }}
                onClick={() => setScanning(true)}
              >
                📷 Escanear el código del teleprompter
              </button>
              <button className="btn wide" onClick={() => setPasting((v) => !v)}>
                Pegar el código
              </button>
              {pasting && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    className="input"
                    style={{ minHeight: 110, fontSize: 12 }}
                    placeholder="Pega aquí el código del teleprompter"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                  />
                  <button
                    className="btn wide"
                    style={{ marginTop: 8 }}
                    disabled={!pasted.trim()}
                    onClick={() => void direct.accept(pasted.trim())}
                  >
                    Continuar
                  </button>
                </div>
              )}
              <div className="muted" style={{ marginTop: 14 }}>
                Los dos teléfonos tienen que estar en la misma wifi. No hace falta que tenga
                Internet: vale el punto de acceso de uno de ellos.
              </div>
              <button
                className="btn wide"
                style={{ marginTop: 12 }}
                onClick={() => {
                  useDirectClient.getState().stop()
                  setMode('choose')
                }}
              >
                Volver a las opciones
              </button>
            </>
          )}
        </div>

        {scanning && (
          <QrScanner
            title="Escanea el código del teleprompter"
            hint="Está en Ajustes → Mando de red → Directo"
            onClose={() => setScanning(false)}
            onResult={(text) => {
              setScanning(false)
              void direct.accept(text)
            }}
          />
        )}
      </div>
    )
  }

  /* ------------------------------------------------------- ya enlazado */

  const statusLabel =
    live.status === 'open'
      ? live.hostOnline
        ? 'Conectado'
        : 'Sala abierta · esperando al teleprompter'
      : live.status === 'connecting'
        ? 'Conectando…'
        : live.status === 'retrying'
          ? live.detail || 'Reintentando…'
          : live.status === 'error'
            ? live.detail || 'Sin conexión'
            : 'Desconectado'

  const tone = live.status === 'open' ? (live.hostOnline ? 'ok' : 'warn') : 'bad'

  return (
    <div className="remote-shell">
      <div className="topbar">
        {back}
        <h1>{state?.currentTitle || 'Mando'}</h1>
        <span className="chip" data-tone={tone}>
          <span className="dot" />
          {mode === 'direct' ? 'Directo' : room}
        </span>
      </div>

      <div className="scroll-area">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between">
            <span className="muted">{statusLabel}</span>
            {live.status !== 'open' && live.retry && (
              <button className="btn" onClick={() => live.retry?.()}>
                Reintentar
              </button>
            )}
          </div>
          {state && (
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="chip">
                {state.status === 'playing'
                  ? '▶ En marcha'
                  : state.status === 'countdown'
                    ? `⏳ ${state.countdownLeft}`
                    : state.status === 'finished'
                      ? '■ Final'
                      : '❚❚ En pausa'}
              </span>
              <span className="muted">
                {formatTime(state.info.elapsed)} · faltan {formatTime(state.info.remaining)}
              </span>
            </div>
          )}
        </div>

        {!state && (
          <div className="empty">
            Esperando al teleprompter…
            <div className="muted" style={{ marginTop: 10 }}>
              Comprueba que el otro teléfono tiene Promoter abierto y el enlace activo.
            </div>
          </div>
        )}

        {controller && <ControlPanel c={controller} />}
      </div>
    </div>
  )
}
