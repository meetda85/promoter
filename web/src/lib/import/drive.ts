import { sanitizeHtml } from '../sanitize'
import { textToHtml } from '../text'
import type { ImportedDoc } from './local'

/**
 * Acceso a Google Drive con Google Identity Services.
 *
 * El token vive sólo en memoria: al cerrar la app hay que volver a autorizar.
 * Es lo correcto para una app que se instala en teléfonos prestados o de
 * producción compartida.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

const GOOGLE_DOC = 'application/vnd.google-apps.document'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  owners?: { displayName?: string }[]
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void
  callback: (resp: { access_token?: string; error?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
let tokenClient: TokenClient | null = null
let accessToken: string | null = null
let tokenExpiry = 0

function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const el = document.createElement('script')
    el.src = GIS_SRC
    el.async = true
    el.defer = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'))
    document.head.appendChild(el)
  })
  return scriptPromise
}

export function isSignedIn(): boolean {
  return !!accessToken && Date.now() < tokenExpiry
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken)
  }
  accessToken = null
  tokenExpiry = 0
}

export async function signIn(clientId: string): Promise<void> {
  if (!clientId) throw new Error('Falta el ID de cliente de Google')
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services no está disponible')

  await new Promise<void>((resolve, reject) => {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Autorización cancelada'))
          return
        }
        accessToken = resp.access_token
        // GIS entrega tokens de una hora; recortamos un minuto de margen.
        tokenExpiry = Date.now() + 59 * 60 * 1000
        resolve()
      },
    })
    tokenClient.requestAccessToken({ prompt: isSignedIn() ? '' : 'consent' })
  })
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  if (!isSignedIn()) throw new Error('Sesión de Google caducada; vuelve a conectar')
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) {
    accessToken = null
    throw new Error('Sesión de Google caducada; vuelve a conectar')
  }
  if (!res.ok) throw new Error(`Drive respondió ${res.status}`)
  return res
}

export async function listFiles(search = ''): Promise<DriveFile[]> {
  const types = [
    `mimeType='${GOOGLE_DOC}'`,
    `mimeType='${DOCX}'`,
    "mimeType='text/plain'",
    "mimeType='text/markdown'",
    "mimeType='application/rtf'",
    "mimeType='text/rtf'",
  ].join(' or ')

  const clauses = [`(${types})`, 'trashed = false']
  if (search.trim()) clauses.push(`name contains '${search.trim().replace(/'/g, "\\'")}'`)

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime,owners(displayName))',
    orderBy: 'modifiedTime desc',
    pageSize: '60',
    spaces: 'drive',
  })
  const res = await api(`files?${params}`)
  const data = (await res.json()) as { files?: DriveFile[] }
  return data.files || []
}

export async function importDriveFile(file: DriveFile): Promise<ImportedDoc> {
  const title = file.name.replace(/\.[^.]+$/, '') || file.name

  if (file.mimeType === GOOGLE_DOC) {
    // El export a HTML conserva negritas, colores y encabezados del documento.
    const res = await api(`files/${file.id}/export?mimeType=text%2Fhtml`)
    return { title, html: sanitizeHtml(await res.text()) }
  }

  if (file.mimeType === DOCX) {
    const res = await api(`files/${file.id}?alt=media`)
    const mammoth = await import('mammoth/mammoth.browser')
    const result = await mammoth.convertToHtml({ arrayBuffer: await res.arrayBuffer() })
    return { title, html: sanitizeHtml(result.value) }
  }

  const res = await api(`files/${file.id}?alt=media`)
  return { title, html: textToHtml(await res.text()) }
}
