/**
 * Contrato común de los dos transportes del mando: el relay por WebSocket y
 * el enlace directo por WebRTC. La app de arriba no sabe cuál está usando.
 */
export type LinkStatus = 'off' | 'connecting' | 'open' | 'retrying' | 'error'

export interface Link {
  readonly connected: boolean
  send(msg: object): void
  /** Como `send`, pero se salta el envío si el contenido no ha cambiado. */
  sendIfChanged(msg: object): void
  close(): void
}

/* ------------------- códigos de emparejamiento (QR / texto) -------------- */

const PREFIX = 'PM1'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function through(bytes: Uint8Array, stream: ReadableWritablePair): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

/**
 * Empaqueta la descripción de sesión para que quepa en un QR.
 *
 * Un SDP ronda el kilobyte; comprimido baja a la mitad larga y entra de sobra
 * en un código legible por una cámara de teléfono.
 */
export async function packCode(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  if (typeof CompressionStream !== 'undefined') {
    const deflated = await through(bytes, new CompressionStream('deflate-raw'))
    return `${PREFIX}z${toBase64Url(deflated)}`
  }
  return `${PREFIX}r${toBase64Url(bytes)}`
}

export async function unpackCode<T>(code: string): Promise<T> {
  const clean = code.trim()
  if (!clean.startsWith(PREFIX)) throw new Error('Ese código no es de Promoter')
  const mode = clean[PREFIX.length]
  const body = fromBase64Url(clean.slice(PREFIX.length + 1))
  const bytes = mode === 'z' ? await through(body, new DecompressionStream('deflate-raw')) : body
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}
