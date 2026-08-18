import { useState } from 'react'
import { useDirectHost } from '../state/useDirectHost'
import { useStore } from '../state/useStore'
import { QrCode } from './QrCode'
import { QrScanner } from './QrScanner'

/**
 * Emparejamiento sin servidor, lado teleprompter.
 *
 * Son dos escaneos porque WebRTC necesita ida y vuelta: el teleprompter
 * propone, el mando responde. A cambio no hay servidor, ni Internet, ni
 * códigos de sala que recordar.
 */
export function DirectPairHost() {
  const { status, offerCode, busy, error, start, finish, stop } = useDirectHost()
  const setToast = useStore((s) => s.setToast)
  const [scanning, setScanning] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  const connected = status === 'open'

  return (
    <div>
      <div className="card">
        <ol className="pair-steps">
          <li data-done={!!offerCode} data-active={!offerCode}>
            Genera el código en este teléfono (el que muestra el texto).
          </li>
          <li data-done={connected} data-active={!!offerCode && !connected}>
            Escanéalo con el otro teléfono, que te devolverá un segundo código.
          </li>
          <li data-done={connected} data-active={!!offerCode && !connected}>
            Escanea aquí ese segundo código y quedáis enlazados.
          </li>
        </ol>
      </div>

      {connected ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="chip" data-tone="ok" style={{ marginBottom: 12 }}>
            <span className="dot" />
            Mando enlazado directamente
          </div>
          <div className="muted" style={{ marginBottom: 12 }}>
            El control va de teléfono a teléfono, sin pasar por ningún servidor.
          </div>
          <button className="btn wide" onClick={() => stop()}>
            Deshacer el enlace
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          {!offerCode ? (
            <button className="btn primary wide big" disabled={busy} onClick={() => void start()}>
              {busy ? <span className="spinner" /> : '🔗'} Generar código de enlace
            </button>
          ) : (
            <>
              <QrCode value={offerCode} />
              <div className="muted" style={{ margin: '10px 0 14px' }}>
                Escanea este código con el teléfono que hará de mando.
              </div>
              <button
                className="btn primary wide big"
                style={{ marginBottom: 8 }}
                onClick={() => setScanning(true)}
              >
                📷 Escanear la respuesta del mando
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn grow" onClick={() => setPasting((v) => !v)}>
                  Pegar respuesta
                </button>
                <button className="btn grow" onClick={() => void start()}>
                  Regenerar
                </button>
              </div>
              <button
                className="btn wide"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(offerCode)
                    setToast('Código copiado: puedes mandarlo por mensaje')
                  } catch {
                    setToast('Este navegador no deja copiar automáticamente')
                  }
                }}
              >
                Copiar el código
              </button>

              {pasting && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    className="input"
                    style={{ minHeight: 110, fontSize: 12 }}
                    placeholder="Pega aquí el código que muestra el mando"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                  />
                  <button
                    className="btn wide"
                    style={{ marginTop: 8 }}
                    disabled={!pasted.trim() || busy}
                    onClick={() => void finish(pasted.trim())}
                  >
                    Enlazar
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="card" style={{ borderColor: 'var(--danger)', marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
      )}

      <div className="muted" style={{ marginTop: 12 }}>
        Los dos teléfonos tienen que estar en la misma wifi (vale el punto de acceso de uno de
        ellos). No hace falta que esa red tenga Internet. En wifis públicas con aislamiento entre
        dispositivos este modo no funciona: ahí usa el enlace por servidor.
      </div>

      {scanning && (
        <QrScanner
          title="Escanea la respuesta del mando"
          hint="Apunta al código que muestra el otro teléfono"
          onClose={() => setScanning(false)}
          onResult={(text) => {
            setScanning(false)
            void finish(text)
          }}
        />
      )}
    </div>
  )
}
