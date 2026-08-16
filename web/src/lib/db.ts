import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, Script } from './types'

interface PromoterDB extends DBSchema {
  scripts: {
    key: string
    value: Script
    indexes: { updatedAt: number }
  }
  meta: {
    key: string
    value: unknown
  }
}

let dbPromise: Promise<IDBPDatabase<PromoterDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<PromoterDB>('promoter', 1, {
      upgrade(database) {
        const store = database.createObjectStore('scripts', { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
        database.createObjectStore('meta')
      },
    })
  }
  return dbPromise
}

export async function listScripts(): Promise<Script[]> {
  const all = await (await db()).getAllFromIndex('scripts', 'updatedAt')
  return all.reverse()
}

export async function getScript(id: string): Promise<Script | undefined> {
  return (await db()).get('scripts', id)
}

export async function putScript(script: Script): Promise<void> {
  await (await db()).put('scripts', script)
}

export async function deleteScript(id: string): Promise<void> {
  await (await db()).delete('scripts', id)
}

export async function loadSettings(): Promise<Partial<AppSettings> | undefined> {
  return (await db()).get('meta', 'settings') as Promise<Partial<AppSettings> | undefined>
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await db()).put('meta', settings, 'settings')
}

export async function exportAll(): Promise<string> {
  const [scripts, settings] = await Promise.all([listScripts(), loadSettings()])
  return JSON.stringify({ version: 1, exportedAt: Date.now(), scripts, settings }, null, 2)
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as { scripts?: Script[] }
  const scripts = Array.isArray(data.scripts) ? data.scripts : []
  const database = await db()
  const tx = database.transaction('scripts', 'readwrite')
  await Promise.all(scripts.map((s) => tx.store.put(s)))
  await tx.done
  return scripts.length
}
