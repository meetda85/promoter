import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/useStore'
import { useRemoteClient } from '../state/useRemoteClient'
import { ControlPanel, type Controller } from './ControlPanel'
import { formatTime } from '../lib/text'
import type { ActionId } from '../lib/types'

function tap() {
  try {
    navigator.vibrate?.(12)
  } catch {
    /* sin vibración: da igual */
  }
}

/** Lee `#/remote?room=XXXX` para que el QR conecte sin escribir nada. */
function roomFromHash(): { room: string; server: string } {
  const hash = location.hash.replace(/^#/, '')
  const qIndex = hash.indexOf('?')
  if (qIndex < 0) return { room: '', server: '' }
  const params = new URLSearchParams(hash.slice(qIndex + 1))
  return { room: (params.get('room') || '').toUpperCase(), server: params.get('server') || '' }
}

export function RemoteControl() {
  const setView = useStore((s) => s.setView)
  const stored = useStore((s) => s.settings.remote)
  const setSettingPath = useStore((s) => s.setSettingPath)

  const fromHash = useMemo(roomFromHash, [])
  const [room, setRoom] = useState(fromHash.room || stored.room || '')
  const [server, setServer] = useState(fromHash.server || stored.serverUrl || '')
  const [connected, setConnected] = useState(!!fromHash.room)
  const [draftRoom, setDraftRoom] = useState(room)
  const [draftServer, setDraftServer] = useState(server)

  const link = useRemoteClient(server, room, connected)

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

  const state = link.state
  const controller: Controller | null = state && {
    settings: state.prompter,
    status: state.status,
    info: state.info,
    markers: state.markers,
    scripts: state.scripts,
    currentId: state.currentId,
    action: (a: ActionId) => {
      tap()
      link.send({ t: 'action', action: a })
    },
    set: (path, value) => link.send({ t: 'set', path, value }),
    select: (id) => {
      tap()
      link.send({ t: 'select', id })
    },
    seek: (ratio) => link.send({ t: 'seek', ratio }),
    jumpMarker: (index) => link.send({ t: 'jumpMarker', index }),
  }

  const statusLabel =
    link.status === 'open'
      ? link.hostOnline
        ? 'Conectado'
        : 'Sala abierta · esperando al teleprompter'
      : link.status === 'connecting'
        ? 'Conectando…'
        : link.status === 'retrying'
          ? link.detail || 'Reintentando…'
          : link.status === 'error'
            ? link.detail || 'Sin conexión'
            : 'Desconectado'

  const tone = link.status === 'open' ? (link.hostOnline ? 'ok' : 'warn') : 'bad'

  if (!connected) {
    return (
      <div className="app">
        <div className="topbar">
          <button className="btn ghost icon" onClick={() => setView('library')} aria-label="Volver">
            ‹
          </button>
          <h1>Usar como mando</h1>
        </div>
        <div className="scroll-area">
          <div className="card">
            <div className="field">
              <label>Código de la sala</label>
              <input
                className="input"
                value={draftRoom}
                onChange={(e) => setDraftRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect="off"
                style={{ fontSize: 26, letterSpacing: '0.18em', textAlign: 'center', fontWeight: 800 }}
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
              className="btn primary wide big"
              disabled={draftRoom.length < 4}
              onClick={() => {
                setRoom(draftRoom)
                setServer(draftServer.trim())
                setSettingPath('remote.serverUrl', draftServer.trim())
                setConnected(true)
              }}
            >
              Conectar
            </button>
            <div className="muted" style={{ marginTop: 12 }}>
              El código aparece en el teleprompter, en Ajustes → Mando de red. Lo más rápido es
              escanear allí el código QR con la cámara de este teléfono.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="remote-shell">
      <div className="topbar">
        <button
          className="btn ghost icon"
          onClick={() => {
            setConnected(false)
            setView('library')
          }}
          aria-label="Salir"
        >
          ‹
        </button>
        <h1>{state?.currentTitle || 'Mando'}</h1>
        <span className="chip" data-tone={tone}>
          <span className="dot" />
          {room}
        </span>
      </div>

      <div className="scroll-area">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between">
            <span className="muted">{statusLabel}</span>
            {link.status !== 'open' && (
              <button className="btn" onClick={() => link.reconnect()}>
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
              Comprueba que el otro teléfono tiene Promoter abierto y el enlace activo con el mismo
              código.
            </div>
          </div>
        )}

        {controller && <ControlPanel c={controller} />}
      </div>
    </div>
  )
}
