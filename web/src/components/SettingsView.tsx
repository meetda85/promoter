import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/useStore'
import { exportAll, importAll } from '../lib/db'
import {
  canInstall,
  isIOS,
  isStandalone,
  onInstallAvailability,
  promptInstall,
} from '../lib/install'
import type { HostLinkInfo } from '../state/useRemoteHost'
import { PairPanel } from './PairPanel'
import { BluetoothPanel } from './BluetoothPanel'
import { Segmented } from './ui'
import { ACTION_LABELS } from '../lib/defaults'
import { prettyKey } from '../lib/keys'

type Tab = 'link' | 'bt' | 'data' | 'help'

export function SettingsView({ link }: { link: HostLinkInfo }) {
  const [tab, setTab] = useState<Tab>('link')
  const setView = useStore((s) => s.setView)
  const setToast = useStore((s) => s.setToast)
  const settings = useStore((s) => s.settings)
  const resetPrompterSettings = useStore((s) => s.resetPrompterSettings)
  const init = useStore((s) => s.init)
  const fileRef = useRef<HTMLInputElement>(null)
  const [installable, setInstallable] = useState(canInstall())

  useEffect(() => onInstallAvailability(setInstallable), [])

  const profile =
    settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0]

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Segmented
          options={[
            { value: 'link', label: 'Mando de red' },
            { value: 'bt', label: 'Bluetooth' },
            { value: 'data', label: 'Datos' },
            { value: 'help', label: 'Ayuda' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'link' && (
        <>
          <PairPanel link={link} />
          <div className="section-title">Este teléfono</div>
          <div className="card">
            <button className="btn wide big" onClick={() => setView('remote')}>
              🎛 Usar este dispositivo como mando
            </button>
            <div className="muted" style={{ marginTop: 8 }}>
              Útil si tienes dos teléfonos: en uno el texto, en el otro los controles.
            </div>
          </div>
        </>
      )}

      {tab === 'bt' && <BluetoothPanel />}

      {tab === 'data' && (
        <>
          <div className="card">
            <button
              className="btn wide"
              style={{ marginBottom: 10 }}
              onClick={async () => {
                const json = await exportAll()
                const blob = new Blob([json], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `promoter-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              ⬇️ Exportar guiones y ajustes
            </button>
            <button className="btn wide" onClick={() => fileRef.current?.click()}>
              ⬆️ Importar copia de seguridad
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const n = await importAll(await file.text())
                  await init()
                  setToast(`${n} guion(es) importado(s)`)
                } catch {
                  setToast('El archivo no es una copia válida')
                }
                e.target.value = ''
              }}
            />
          </div>

          <div className="section-title">Aspecto del prompter</div>
          <div className="card">
            <button className="btn wide" onClick={() => resetPrompterSettings()}>
              Restablecer valores por defecto
            </button>
          </div>

          <div className="section-title">Google Drive</div>
          <div className="card">
            <div className="field">
              <label>ID de cliente OAuth</label>
              <input
                className="input"
                value={settings.drive.clientId}
                placeholder="…apps.googleusercontent.com"
                onChange={(e) =>
                  useStore.getState().setSettingPath('drive.clientId', e.target.value.trim())
                }
              />
            </div>
            <div className="muted">
              Origen que hay que autorizar en Google Cloud: <b>{location.origin}</b>
            </div>
          </div>
        </>
      )}

      {tab === 'help' && (
        <>
          {!isStandalone() && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Instalar en el teléfono</div>
              {installable ? (
                <button
                  className="btn primary wide"
                  onClick={async () => {
                    if (await promptInstall()) setToast('Promoter instalado')
                  }}
                >
                  Instalar Promoter
                </button>
              ) : isIOS() ? (
                <div className="muted">
                  En iPhone y iPad: abre esta página en Safari, pulsa el botón «Compartir» y elige
                  «Añadir a pantalla de inicio». Se instala como una app normal y funciona sin
                  conexión.
                </div>
              ) : (
                <div className="muted">
                  En Android: menú del navegador → «Instalar aplicación» o «Añadir a pantalla de
                  inicio».
                </div>
              )}
            </div>
          )}

          <div className="section-title">Atajos del perfil «{profile?.name}»</div>
          <div className="card">
            {profile?.bindings.map((b) => (
              <div className="binding-row" key={b.code}>
                <span className="kbd">{prettyKey(b.code)}</span>
                <span className="grow">{ACTION_LABELS[b.action]}</span>
              </div>
            ))}
          </div>

          <div className="section-title">Gestos en la pantalla del prompter</div>
          <div className="card">
            <div className="binding-row">
              <span className="kbd">Toque</span>
              <span className="grow">Reproducir / pausar</span>
            </div>
            <div className="binding-row">
              <span className="kbd">Arrastrar</span>
              <span className="grow">Mover el texto a mano</span>
            </div>
            <div className="binding-row">
              <span className="kbd">Pellizcar</span>
              <span className="grow">Cambiar el tamaño de letra</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
