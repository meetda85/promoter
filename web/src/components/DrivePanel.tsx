import { useEffect, useState } from 'react'
import { useStore } from '../state/useStore'
import {
  importDriveFile,
  isSignedIn,
  listFiles,
  signIn,
  signOut,
  type DriveFile,
} from '../lib/import/drive'

export function DrivePanel({ onImported }: { onImported: () => void }) {
  const clientId = useStore((s) => s.settings.drive.clientId)
  const setSettingPath = useStore((s) => s.setSettingPath)
  const createScript = useStore((s) => s.createScript)
  const setToast = useStore((s) => s.setToast)

  const [signed, setSigned] = useState(isSignedIn())
  const [files, setFiles] = useState<DriveFile[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (q = search) => {
    setBusy(true)
    setError(null)
    try {
      setFiles(await listFiles(q))
    } catch (e) {
      setError((e as Error).message)
      setSigned(isSignedIn())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (signed) void refresh('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed])

  if (!signed) {
    return (
      <div>
        <div className="muted" style={{ marginBottom: 14 }}>
          Promoter se conecta a tu Drive con tu propio ID de cliente de Google, así que ningún
          servidor intermedio ve tus documentos. Créalo en Google Cloud → «Credenciales» → «ID de
          cliente de OAuth» de tipo <b>Aplicación web</b> y añade el origen desde el que abres esta
          app.
        </div>

        <div className="field">
          <label>ID de cliente de Google (termina en .apps.googleusercontent.com)</label>
          <input
            className="input"
            value={clientId}
            placeholder="1234567890-abcdef.apps.googleusercontent.com"
            onChange={(e) => setSettingPath('drive.clientId', e.target.value.trim())}
          />
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          className="btn primary wide big"
          disabled={!clientId || busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await signIn(clientId)
              setSigned(true)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? <span className="spinner" /> : '☁️'} Conectar con Google Drive
        </button>

        <div className="muted" style={{ marginTop: 12 }}>
          Origen autorizado que debes pegar en Google Cloud: <b>{location.origin}</b>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input
          className="input grow"
          placeholder="Buscar en Drive…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void refresh()
          }}
        />
        <button className="btn" onClick={() => void refresh()} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!busy && files.length === 0 && <div className="muted">No hay documentos que coincidan.</div>}

      {files.map((f) => (
        <button
          key={f.id}
          className="drive-item"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const doc = await importDriveFile(f)
              await createScript({
                title: doc.title,
                html: doc.html,
                source: 'drive',
                sourceRef: f.id,
              })
              setToast(`«${doc.title}» importado`)
              onImported()
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <span style={{ fontSize: 20 }}>
            {f.mimeType === 'application/vnd.google-apps.document' ? '📄' : '📎'}
          </span>
          <span className="grow">
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.name}
            </div>
            <div className="muted">
              {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''}
            </div>
          </span>
        </button>
      ))}

      <button
        className="btn wide"
        style={{ marginTop: 14 }}
        onClick={() => {
          signOut()
          setSigned(false)
          setFiles([])
        }}
      >
        Desconectar cuenta
      </button>
    </div>
  )
}
