import { useEffect, useState } from 'react'
import { useStore } from '../state/useStore'
import { captureNextKey } from '../state/useKeyRemote'
import { prettyKey } from '../lib/keys'
import { ACTION_LABELS } from '../lib/defaults'
import type { ActionId, KeyBinding, RemoteProfile } from '../lib/types'
import { newId } from '../lib/text'
import { ToggleRow } from './ui'

const ACTIONS = Object.keys(ACTION_LABELS) as ActionId[]

export function BluetoothPanel() {
  const settings = useStore((s) => s.settings)
  const patchSettings = useStore((s) => s.patchSettings)
  const setSettingPath = useStore((s) => s.setSettingPath)
  const setToast = useStore((s) => s.setToast)

  const [learning, setLearning] = useState<null | { action: ActionId; replacing?: string }>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)

  const profile =
    settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0]

  /** Los perfiles de fábrica no se tocan: al editarlos se crea una copia. */
  const editable = (fn: (p: RemoteProfile) => RemoteProfile) => {
    let target = profile
    let profiles = settings.profiles
    let activeId = settings.activeProfileId

    if (profile.builtIn) {
      target = {
        ...profile,
        id: newId(),
        name: `${profile.name} (mi copia)`,
        builtIn: false,
        bindings: profile.bindings.map((b) => ({ ...b })),
      }
      profiles = [...profiles, target]
      activeId = target.id
    }

    const updated = fn(target)
    patchSettings({
      profiles: profiles.map((p) => (p.id === updated.id ? updated : p)),
      activeProfileId: activeId,
    })
  }

  useEffect(() => () => captureNextKey(null), [])

  const startLearning = (action: ActionId, replacing?: string) => {
    setLearning({ action, replacing })
    captureNextKey((code) => {
      setLearning(null)
      setLastKey(code)
      editable((p) => {
        const bindings = p.bindings.filter((b) => b.code !== code && b.code !== replacing)
        const binding: KeyBinding = { code, action, label: ACTION_LABELS[action] }
        return { ...p, bindings: [...bindings, binding] }
      })
      setToast(`«${prettyKey(code)}» → ${ACTION_LABELS[action]}`)
    })
  }

  return (
    <div>
      <div className="muted" style={{ marginBottom: 12 }}>
        Empareja el mando por Bluetooth desde los ajustes del teléfono (se anuncia como teclado). Al
        pulsar sus botones, Promoter recibe teclas: aquí decides qué hace cada una. Funciona con
        mandos de teleprompter, pedales, pasapáginas y disparadores de fotos.
      </div>

      <div className="field">
        <label>Perfil del mando</label>
        <select
          className="input"
          value={settings.activeProfileId}
          onChange={(e) => patchSettings({ activeProfileId: e.target.value })}
        >
          {settings.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {profile.bindings.length === 0 && (
          <div className="muted">Este perfil no tiene botones asignados todavía.</div>
        )}
        {profile.bindings.map((b) => (
          <div className="binding-row" key={b.code}>
            <span className="kbd">{prettyKey(b.code)}</span>
            <select
              className="input grow"
              value={b.action}
              onChange={(e) =>
                editable((p) => ({
                  ...p,
                  bindings: p.bindings.map((x) =>
                    x.code === b.code ? { ...x, action: e.target.value as ActionId } : x,
                  ),
                }))
              }
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
            <button
              className="btn ghost icon"
              title="Reasignar tecla"
              onClick={() => startLearning(b.action, b.code)}
            >
              ⟳
            </button>
            <button
              className="btn ghost icon danger"
              title="Quitar"
              onClick={() =>
                editable((p) => ({ ...p, bindings: p.bindings.filter((x) => x.code !== b.code) }))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="section-title">Aprender un botón</div>
      <div className="card">
        {learning ? (
          <div className="learning" style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Pulsa ahora el botón del mando
            </div>
            <div className="muted">Se asignará a: {ACTION_LABELS[learning.action]}</div>
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                captureNextKey(null)
                setLearning(null)
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <div className="muted" style={{ marginBottom: 10 }}>
              Elige la acción y después pulsa el botón físico que quieras usar.
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {(['toggle', 'restart', 'speedUp', 'speedDown', 'pageDown', 'pageUp', 'library', 'markerNext'] as ActionId[]).map(
                (a) => (
                  <button key={a} className="btn" onClick={() => startLearning(a)}>
                    {ACTION_LABELS[a]}
                  </button>
                ),
              )}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Otra acción</label>
              <select
                className="input"
                value=""
                onChange={(e) => e.target.value && startLearning(e.target.value as ActionId)}
              >
                <option value="">Elegir acción…</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {lastKey && !learning && (
          <div className="muted" style={{ marginTop: 8 }}>
            Última tecla detectada: <span className="kbd">{prettyKey(lastKey)}</span>
          </div>
        )}
      </div>

      <div className="section-title">Extras</div>
      <div className="card">
        <ToggleRow
          label="Capturar botones de volumen y multimedia"
          hint="Para mandos que envían Play/Pausa en vez de teclas. Requiere tocar la pantalla una vez."
          checked={settings.remote.mediaKeys}
          onChange={(v) => setSettingPath('remote.mediaKeys', v)}
        />
        {!profile.builtIn && (
          <button
            className="btn wide danger"
            style={{ marginTop: 10 }}
            onClick={() => {
              const profiles = settings.profiles.filter((p) => p.id !== profile.id)
              patchSettings({ profiles, activeProfileId: profiles[0]?.id || 'universal' })
            }}
          >
            Borrar este perfil
          </button>
        )}
      </div>
    </div>
  )
}
