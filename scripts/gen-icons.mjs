// 產生 PWA 佔位 icon（主色底＋白色圓形），之後有正式 logo 再替換 public/pwa-*.png
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const PRIMARY = [0x1f, 0x8a, 0x70]
const WHITE = [0xff, 0xff, 0xff]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.28
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2
      const [rr, gg, bb] = inCircle ? WHITE : PRIMARY
      const o = 1 + x * 3
      row[o] = rr
      row[o + 1] = gg
      row[o + 2] = bb
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}.png`, makePng(size))
  console.log(`public/pwa-${size}.png`)
}
