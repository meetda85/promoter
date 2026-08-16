import { useEffect, useState } from 'react'
import { useStore } from './state/useStore'
import { useRemoteHost } from './state/useRemoteHost'
import { useKeyRemote, useMediaKeyRemote } from './state/useKeyRemote'
import { Library } from './components/Library'
import { Editor } from './components/Editor'
import { Prompter } from './components/Prompter'
import { RemoteControl } from './components/RemoteControl'

export default function App() {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const editingId = useStore((s) => s.editingId)
  const toast = useStore((s) => s.toast)
  const init = useStore((s) => s.init)
  const setView = useStore((s) => s.setView)
  const mediaKeys = useStore((s) => s.settings.remote.mediaKeys)

  const [booted, setBooted] = useState(false)

  useEffect(() => {
    void init().then(() => {
      // El QR del emparejamiento abre directamente el mando.
      if (location.hash.startsWith('#/remote')) setView('remote')
      setBooted(true)
    })
  }, [init, setView])

  const link = useRemoteHost(view !== 'remote')
  useKeyRemote()
  useMediaKeyRemote(mediaKeys)

  if (!ready || !booted) {
    return (
      <div className="empty" style={{ paddingTop: '35vh' }}>
        <span className="spinner" style={{ margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <>
      {view === 'library' && <Library link={link} />}
      {view === 'editor' && editingId && <Editor id={editingId} />}
      {view === 'prompter' && <Prompter />}
      {view === 'remote' && <RemoteControl />}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
