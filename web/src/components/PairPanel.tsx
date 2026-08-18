import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useStore } from '../state/useStore'
import { makeRoomCode } from '../lib/defaults'
import type { HostLinkInfo } from '../state/useRemoteHost'
import { Segmented, ToggleRow } from './ui'
import { DirectPairHost } from './DirectPairHost'

/** Base http(s) equivalente al servidor configurado, para construir el enlace del mando. */
function httpBase(serverUrl: string): string {
  const raw = serverUrl.trim()
  if (!raw) return location.origin
  let normalized = raw
  if (!/^[a-z]+:\/\//i.test(normalized)) normalized = `http://${normalized}`
  normalized = normalized.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:')
  try {
    return new URL(normalized).origin
  } catch {
    return location.origin
  }
}

export function PairPanel({ link }: { link: HostLinkInfo }) {
  const remote = useStore((s) => s.settings.remote)
  const setSettingPath = useStore((s) => s.setSettingPath)
  const setToast = useStore((s) => s.setToast)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [serverDraft, setServerDraft] = useState(remote.serverUrl)

  const remoteUrl = `${httpBase(remote.serverUrl)}/#/remote?room=${remote.room}`

  useEffect(() => {
    if (remote.mode !== 'relay' || !canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, remoteUrl, {
      width: 360,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [remoteUrl, remote.mode])

  const statusText: Record<string, string> = {
    off: 'Enlace apagado',
    connecting: 'Conectando…',
    open:
      link.remotes > 0 ? `${link.remotes} mando(s) conectado(s)` : 'Sala abierta, esperando mando',
    retrying: link.detail || 'Reintentando…',
    error: link.detail || 'Sin conexión con el servidor',
  }

  const tone =
    link.status === 'open'
      ? link.remotes > 0
        ? 'ok'
        : 'warn'
      : link.status === 'off'
        ? undefined
        : 'bad'

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Segmented
          options={[
            { value: 'relay', label: 'Por servidor' },
            { value: 'direct', label: 'Directo, sin internet' },
          ]}
          value={remote.mode}
          onChange={(v) => setSettingPath('remote.mode', v)}
        />
      </div>

      {remote.mode === 'direct' ? (
        <DirectPairHost />
      ) : (
        <>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="chip" data-tone={tone} style={{ marginBottom: 10 }}>
              <span className="dot" />
              {statusText[link.status]}
            </div>

            {link.status === 'error' && (
              <div
                className="card"
                style={{
                  borderColor: 'var(--danger)',
                  marginBottom: 10,
                  textAlign: 'left',
                }}
              >
                <div className="muted" style={{ marginBottom: 10 }}>
                  {link.detail}
                </div>
                <button className="btn wide" onClick={() => link.retry()}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="qr">
              <canvas ref={canvasRef} />
            </div>

            <div className="code-display">{remote.room}</div>
            <div className="muted">
              Escanea el código con el otro teléfono, o abre <b>{httpBase(remote.serverUrl)}</b> y
              escribe este código en «Usar como mando».
            </div>

            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                className="btn grow"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(remoteUrl)
                    setToast('Enlace copiado')
                  } catch {
                    setToast(remoteUrl)
                  }
                }}
              >
                Copiar enlace
              </button>
              <button
                className="btn grow"
                onClick={() => {
                  setSettingPath('remote.room', makeRoomCode())
                  setToast('Código nuevo generado')
                }}
              >
                Cambiar código
              </button>
            </div>
          </div>

          <div className="section-title">Servidor</div>
          <div className="card">
            <div className="field">
              <label>Dirección del servidor (déjalo vacío para usar este mismo)</label>
              <input
                className="input"
                placeholder="192.168.1.20:8080"
                value={serverDraft}
                onChange={(e) => setServerDraft(e.target.value)}
                onBlur={() => setSettingPath('remote.serverUrl', serverDraft.trim())}
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div className="muted">
              Si has abierto la app desde la dirección IP del ordenador que ejecuta el servidor, no
              hace falta tocar nada: los dos teléfonos se encuentran solos por la wifi. Rellena este
              campo sólo si quieres apuntar a otro servidor (por ejemplo uno público, para controlar
              el teleprompter desde fuera de la red local).
            </div>

            <div style={{ marginTop: 10 }}>
              <ToggleRow
                label="Enlace activo"
                hint="Permite que otro teléfono controle este teleprompter"
                checked={remote.autoConnect}
                onChange={(v) => setSettingPath('remote.autoConnect', v)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
