import { useStore } from '../state/useStore'
import { ScriptEditor } from './ScriptEditor'

/** Editor del guion sobre la base de datos local del propio teleprompter. */
export function Editor({ id }: { id: string }) {
  const script = useStore((s) => s.scripts.find((x) => x.id === id))
  const saveScript = useStore((s) => s.saveScript)
  const setView = useStore((s) => s.setView)
  const openPrompter = useStore((s) => s.openPrompter)

  if (!script) {
    return (
      <div className="empty">
        Este guion ya no existe.
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setView('library')}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScriptEditor
      docKey={script.id}
      initialTitle={script.title}
      initialHtml={script.html}
      onSave={(title, html) => saveScript({ ...script, title, html })}
      onBack={() => setView('library')}
      onPrimary={() => openPrompter(script.id)}
      primaryLabel="Leer"
    />
  )
}
