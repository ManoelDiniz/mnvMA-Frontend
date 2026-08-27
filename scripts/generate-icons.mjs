import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Gera os ícones do PWA sem depender de biblioteca gráfica.
 *
 * Sem ícone 192/512 o navegador não oferece a instalação — e instalar no
 * celular é requisito do produto. Como não há rasterizador disponível aqui, o
 * PNG é escrito na mão (zlib + CRC32) e a marca é desenhada por matemática de
 * pixel: quadrado arredondado na cor da marca + um "M" vazado.
 *
 * Rode com `npm run icons` sempre que a cor da marca mudar.
 */

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

const BRAND = [14, 116, 144] // #0E7490 — cyan-700
const INK = [255, 255, 255]

// ─── PNG mínimo (RGBA, sem filtro) ────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0

  for (let y = 0; y < size; y++) {
    raw[offset++] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y)
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
      raw[offset++] = a
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Marca ────────────────────────────────────────────────────────────────────

/** Distância até o retângulo arredondado, para antialias nas bordas. */
function roundedRectDistance(x, y, size, radius, inset) {
  const half = size / 2 - inset
  const dx = Math.abs(x - size / 2) - (half - radius)
  const dy = Math.abs(y - size / 2) - (half - radius)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - radius
}

/**
 * "M" desenhado como quatro traços diagonais/verticais: duas hastes e o vale
 * central. Escala com o tamanho, então fica nítido em 192 e em 512.
 */
function insideM(x, y, size, scale) {
  const s = size * scale
  const left = (size - s) / 2
  const top = (size - s * 0.78) / 2
  const u = (x - left) / s
  const v = (y - top) / (s * 0.78)

  if (u < 0 || u > 1 || v < 0 || v > 1) return false

  const stroke = 0.19

  // hastes verticais
  if (u < stroke) return true
  if (u > 1 - stroke) return true

  // vale central: duas diagonais que se encontram no meio
  const half = stroke / 2 / Math.cos(Math.PI / 5)
  if (v <= 0.62) {
    const leftDiagonal = 0.5 * (v / 0.62)
    if (Math.abs(u - (stroke / 2 + leftDiagonal * 0.86)) < half) return true
    if (Math.abs(u - (1 - stroke / 2 - leftDiagonal * 0.86)) < half) return true
  }

  return false
}

function makeIcon(size, { maskable = false } = {}) {
  // Ícone maskable precisa de zona segura: a plataforma recorta até 20% das bordas.
  const inset = maskable ? 0 : size * 0.06
  const radius = maskable ? 0 : size * 0.22
  const glyphScale = maskable ? 0.46 : 0.58

  return encodePng(size, (x, y) => {
    const px = x + 0.5
    const py = y + 0.5

    let alpha = 255
    if (!maskable) {
      const d = roundedRectDistance(px, py, size, radius, inset)
      if (d > 1) return [0, 0, 0, 0]
      alpha = d > 0 ? Math.round(255 * (1 - d)) : 255
    }

    if (insideM(px, py, size, glyphScale)) return [...INK, alpha]
    return [...BRAND, alpha]
  })
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

const arquivos = [
  ['icon-192.png', makeIcon(192)],
  ['icon-512.png', makeIcon(512)],
  ['maskable-512.png', makeIcon(512, { maskable: true })],
  ['apple-touch-icon.png', makeIcon(180, { maskable: true })],
  ['favicon-32.png', makeIcon(32)],
]

for (const [nome, buffer] of arquivos) {
  writeFileSync(resolve(OUT_DIR, nome), buffer)
  console.log(`  ${nome.padEnd(24)} ${(buffer.length / 1024).toFixed(1)} KB`)
}

console.log(`\nÍcones gerados em public/icons (cor da marca: rgb(${BRAND.join(', ')}))`)
