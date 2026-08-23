// 生成 PWA 占位图标（纯色+圆心，M1 设计阶段替换为正式 logo）
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
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
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0 // filter: none
    offset += 1
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(x, y)
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
      offset += 4
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0xd9, 0x48, 0x0f, 0xff]
const BOWL = [0xff, 0xf7, 0xed, 0xff]

function pixel(x, y, size) {
  const dx = x - size / 2 + 0.5
  const dy = y - size / 2 + 0.5
  return dx * dx + dy * dy <= (size * 0.3) ** 2 ? BOWL : BG
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
await mkdir(outDir, { recursive: true })

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of targets) {
  await writeFile(join(outDir, name), encodePng(size, (x, y) => pixel(x, y, size)))
  console.log(`✓ ${name} (${size}x${size})`)
}
