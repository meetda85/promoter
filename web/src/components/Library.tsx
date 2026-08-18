import { useRef, useState } from 'react'
import { useStore } from '../state/useStore'
import { ACCEPTED_EXTENSIONS, importFiles } from '../lib/import/local'
import { textToHtml } from '../lib/text'
import { Sheet } from './ui'
import { DrivePanel } from './DrivePanel'
import { SettingsView } from './SettingsView'
import type { HostLinkInfo } from '../state/useRemoteHost'

export function Library({ link }: { link: HostLinkInfo }) {
  const scripts = useStore((s) => s.scripts)
  const currentId = useStore((s) => s.currentId)
  const createScript = useStore((s) => s.createScript)
  const removeScript = useStore((s) => s.removeScript)
  const openPrompter = useStore((s) => s.openPrompter)
  const openEditor = useStore((s) => s.openEditor)
  const setToast = useStore((s) => s.setToast)

  const [sheet, setSheet] = useState<null | 'add' | 'paste' | 'drive' | 'settings'>(null)
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setBusy(true)
    try {
      const docs = await importFiles(files)
      for (const doc of docs) {
        await createScript({ title: doc.title, html: doc.html, source: 'local' })
      }
      setToast(`${docs.length} guion(es) importado(s)`)
      setSheet(null)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remoteTone =
    link.status === 'open'
      ? link.remotes > 0
        ? 'ok'
        : 'warn'
      : link.status === 'off'
        ? 'idle'
        : 'bad'

  return (
    <div className="app">
      <div className="topbar">
        <h1>Promoter</h1>
        <button
          className="chip"
          data-tone={remoteTone === 'idle' ? undefined : remoteTone}
          onClick={() => setSheet('settings')}
        >
          <span className="dot" />
          {link.status === 'open'
            ? link.remotes > 0
              ? `${link.remotes} mando${link.remotes > 1 ? 's' : ''}`
              : 'Sala lista'
            : 'Sin enlace'}
        </button>
        <button
          className="btn ghost icon"
          onClick={() => setSheet('settings')}
          aria-label="Ajustes"
        >
          ⚙
        </button>
      </div>

      <div className="scroll-area">
        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          <button className="btn primary grow" onClick={() => setSheet('add')}>
            + Añadir guion
          </button>
        </div>

        {scripts.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
            Todavía no hay guiones.
            <br />
            Impórtalos desde Google Drive, desde un archivo o pégalos a mano.
          </div>
        )}

        {scripts.map((s) => (
          <div key={s.id} className="script-item" data-current={s.id === currentId}>
            <button
              className="grow"
              style={{ textAlign: 'left', background: 'none' }}
              onClick={() => openPrompter(s.id)}
            >
              <h3>{s.title}</h3>
              <div className="muted">
                {s.wordCount} palabras · ~{Math.max(1, Math.round(s.wordCount / 140))} min ·{' '}
                {new Date(s.updatedAt).toLocaleDateString()}
              </div>
            </button>
            <button className="btn ghost icon" onClick={() => openEditor(s.id)} aria-label="Editar">
              ✎
            </button>
            <button
              className="btn ghost icon danger"
              onClick={async () => {
                if (confirm(`¿Borrar "${s.title}"?`)) {
                  await removeScript(s.id)
                  setToast('Guion borrado')
                }
              }}
              aria-label="Borrar"
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: 'none' }}
        onChange={(e) => void onFiles(e.target.files)}
      />

      {sheet === 'add' && (
        <Sheet title="Añadir guion" onClose={() => setSheet(null)}>
          <button
            className="btn wide big"
            style={{ marginBottom: 10 }}
            onClick={async () => {
              const s = await createScript({ title: 'Guion sin título' })
              setSheet(null)
              openEditor(s.id)
            }}
          >
            ✏️ Escribir uno nuevo
          </button>
          <button
            className="btn wide big"
            style={{ marginBottom: 10 }}
            onClick={() => setSheet('paste')}
          >
            📋 Pegar texto
          </button>
          <button
            className="btn wide big"
            style={{ marginBottom: 10 }}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? <span className="spinner" /> : '📄'} Importar archivo (.txt .md .docx .rtf
            .html)
          </button>
          <button className="btn wide big" onClick={() => setSheet('drive')}>
            ☁️ Google Drive
          </button>
        </Sheet>
      )}

      {sheet === 'paste' && (
        <Sheet
          title="Pegar texto"
          onClose={() => setSheet(null)}
          actions={
            <button
              className="btn primary"
              disabled={!paste.trim()}
              onClick={async () => {
                const firstLine = paste.trim().split('\n')[0].slice(0, 60)
                const s = await createScript({
                  title: firstLine || 'Guion pegado',
                  html: textToHtml(paste),
                  source: 'paste',
                })
                setPaste('')
                setSheet(null)
                openEditor(s.id)
              }}
            >
              Crear
            </button>
          }
        >
          <textarea
            className="input"
            style={{ minHeight: '40vh', resize: 'vertical' }}
            placeholder="Pega aquí el guion…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="muted" style={{ marginTop: 8 }}>
            Las líneas en mayúsculas se convierten en marcadores de sección.
          </div>
        </Sheet>
      )}

      {sheet === 'drive' && (
        <Sheet title="Google Drive" onClose={() => setSheet(null)}>
          <DrivePanel onImported={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'settings' && (
        <Sheet title="Ajustes" onClose={() => setSheet(null)}>
          <SettingsView link={link} />
        </Sheet>
      )}
    </div>
  )
}
