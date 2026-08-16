/**
 * Genera los iconos PNG de la PWA sin depender de librerías de imagen.
 * Se ejecuta a mano cuando cambia el logo: `node scripts/make-icons.mjs`
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'web', 'public', 'icons')

const BG = [11, 11, 15, 255]
const FG = [245, 245, 247, 255]
const ACCENT = [255, 176, 46, 255]

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const px = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = color[0]
    buf[i + 1] = color[1]
    buf[i + 2] = color[2]
    buf[i + 3] = color[3]
  }
  const rect = (x0, y0, w, h, color, r = 0) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (r > 0) {
          const dx = Math.max(x0 + r - x, x - (x0 + w - 1 - r), 0)
          const dy = Math.max(y0 + r - y, y - (y0 + h - 1 - r), 0)
          if (dx * dx + dy * dy > r * r) continue
        }
        px(x, y, color)
      }
    }
  }

  rect(0, 0, size, size, BG)

  // Con `maskable` el sistema recorta los bordes: el dibujo va más centrado.
  const pad = Math.round(size * (maskable ? 0.28 : 0.18))
  const inner = size - pad * 2
  const lineH = Math.round(inner * 0.115)
  const gap = Math.round(inner * 0.09)
  const widths = [1, 0.82, 0.94, 0.68]
  let y = pad + Math.round(inner * 0.12)
  widths.forEach((w, i) => {
    rect(pad, y, Math.round(inner * w), lineH, i === 1 ? ACCENT : FG, Math.floor(lineH / 2))
    y += lineH + gap
  })
  return encodePng(size, size, buf)
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'icon-192.png'), draw(192))
fs.writeFileSync(path.join(OUT, 'icon-512.png'), draw(512))
fs.writeFileSync(path.join(OUT, 'icon-512-maskable.png'), draw(512, { maskable: true }))
console.log('Iconos generados en', OUT)
