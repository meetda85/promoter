/**
 * Promoter — servidor de la PWA + relay de emparejamiento.
 *
 * Hace dos cosas y nada más:
 *   1. Sirve el build estático de `web/dist` (con fallback SPA).
 *   2. Expone /ws, un relay por salas: un "host" (el teléfono que hace de
 *      teleprompter) y N "remotes" (el teléfono/tablet que hace de control).
 *
 * Funciona igual en LAN (misma red wifi, sin internet) que desplegado en un
 * servidor público. El relay no interpreta los mensajes: sólo los reenvía.
 */
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const DIST = process.env.PROMOTER_DIST || path.join(ROOT, 'web', 'dist')
const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/** Evita salir del directorio servido con rutas tipo `../../etc/passwd`. */
function safeJoin(base, target) {
  const resolved = path.resolve(base, '.' + path.posix.normalize('/' + target))
  return resolved.startsWith(base) ? resolved : null
}

async function serveFile(res, filePath, { immutable = false } = {}) {
  const ext = path.extname(filePath).toLowerCase()
  const stat = await fsp.stat(filePath)
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] })
      res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }))
      return
    }

    // Permite que el control remoto descubra a qué servidor se conectó.
    if (url.pathname === '/api/info') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] })
      res.end(JSON.stringify({ name: 'promoter-relay', version: 1, addresses: localAddresses() }))
      return
    }

    if (!fs.existsSync(DIST)) {
      res.writeHead(503, { 'Content-Type': MIME['.txt'] })
      res.end(
        'No se encontró el build de la app.\nEjecuta `npm run build` en la raíz del proyecto y vuelve a arrancar.\n',
      )
      return
    }

    const target = safeJoin(DIST, decodeURIComponent(url.pathname))
    if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
      await serveFile(res, target, { immutable: url.pathname.startsWith('/assets/') })
      return
    }

    // Fallback SPA: cualquier ruta desconocida devuelve el index.
    const index = path.join(DIST, 'index.html')
    if (fs.existsSync(index)) {
      await serveFile(res, index)
      return
    }

    res.writeHead(404, { 'Content-Type': MIME['.txt'] })
    res.end('No encontrado')
  } catch (err) {
    res.writeHead(500, { 'Content-Type': MIME['.txt'] })
    res.end('Error del servidor: ' + (err && err.message))
  }
})

/* ------------------------------- relay ---------------------------------- */

/** code -> { host: ws|null, remotes: Map<peerId, ws>, createdAt } */
const rooms = new Map()
let peerSeq = 0

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname !== '/ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj))
}

function roomOf(code) {
  let room = rooms.get(code)
  if (!room) {
    room = { host: null, remotes: new Map(), createdAt: Date.now() }
    rooms.set(code, room)
  }
  return room
}

function announce(code) {
  const room = rooms.get(code)
  if (!room) return
  const status = {
    t: 'peers',
    hostOnline: !!room.host,
    remotes: room.remotes.size,
  }
  send(room.host, status)
  for (const ws of room.remotes.values()) send(ws, status)
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const code = (url.searchParams.get('room') || '').toUpperCase().slice(0, 12)
  const role = url.searchParams.get('role') === 'host' ? 'host' : 'remote'
  const label = (url.searchParams.get('name') || '').slice(0, 40)

  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    send(ws, { t: 'error', code: 'bad_room', message: 'Código de sala inválido' })
    ws.close()
    return
  }

  const peerId = `p${++peerSeq}`
  const room = roomOf(code)
  ws.isAlive = true
  ws.meta = { code, role, peerId, label }

  if (role === 'host') {
    // Un teleprompter nuevo con el mismo código sustituye al anterior:
    // es lo que espera alguien que recarga la app y vuelve a entrar.
    if (room.host && room.host !== ws) {
      send(room.host, { t: 'error', code: 'replaced', message: 'Otro dispositivo tomó esta sala' })
      room.host.close()
    }
    room.host = ws
  } else {
    room.remotes.set(peerId, ws)
  }

  send(ws, {
    t: 'hello',
    peerId,
    role,
    room: code,
    hostOnline: !!room.host,
    remotes: room.remotes.size,
  })
  announce(code)

  ws.on('message', (data, isBinary) => {
    if (isBinary) return
    const text = data.toString()
    if (text.length > 2_000_000) return // guion enorme: se ignora, no se cae el relay

    let msg
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    if (msg && msg.t === 'ping') {
      send(ws, { t: 'pong', ts: msg.ts })
      return
    }

    const envelope = JSON.stringify({ ...msg, from: role, peerId })
    if (role === 'host') {
      // Del prompter a los mandos: estado, biblioteca, confirmaciones.
      const only = msg && msg.to
      for (const [id, remote] of room.remotes) {
        if (only && only !== id) continue
        if (remote.readyState === remote.OPEN) remote.send(envelope)
      }
    } else {
      if (room.host && room.host.readyState === room.host.OPEN) {
        room.host.send(envelope)
      } else {
        send(ws, { t: 'error', code: 'no_host', message: 'El teleprompter no está conectado' })
      }
    }
  })

  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('close', () => {
    const r = rooms.get(code)
    if (!r) return
    if (role === 'host' && r.host === ws) r.host = null
    else r.remotes.delete(peerId)
    if (!r.host && r.remotes.size === 0) rooms.delete(code)
    else announce(code)
  })
})

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    try {
      ws.ping()
    } catch {
      /* el cierre lo gestiona el evento 'close' */
    }
  }
}, 30_000)
wss.on('close', () => clearInterval(heartbeat))

/* ------------------------------ arranque -------------------------------- */

function localAddresses() {
  const out = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address)
    }
  }
  return out
}

server.listen(PORT, HOST, () => {
  const addrs = localAddresses()
  console.log('\n  Promoter — teleprompter\n')
  console.log(`  Local:   http://localhost:${PORT}`)
  for (const a of addrs) console.log(`  Red:     http://${a}:${PORT}`)
  console.log(
    addrs.length
      ? '\n  Abre la dirección "Red" en el teléfono que hará de teleprompter\n' +
          '  y también en el que hará de control remoto.\n'
      : '\n  Sin interfaces de red visibles; sólo acceso local.\n',
  )
})
