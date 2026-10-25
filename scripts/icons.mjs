#!/usr/bin/env node
// DevForge's logo, the same as the mobile app's (devforge-mobile/app/scripts/icons.mjs):
// an orange anvil on a dark rounded square. Writes the PNGs the app uses, with no
// dependency (supersampled for smooth edges), and the SVG kept as the reference.
//
//   node scripts/icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [15, 17, 23]
const FG = [249, 115, 22]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, inside) {
  const rows = []
  const S = 4
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) {
      let fg = 0, bgA = 0
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const u = (x + (sx + 0.5) / S) / size, v = (y + (sy + 0.5) / S) / size
        const r = inside(u, v)
        if (r === 'fg') fg++
        if (r !== 'out') bgA++
      }
      const n = S * S, a = bgA / n, f = bgA ? fg / bgA : 0
      const o = 1 + x * 4
      for (let i = 0; i < 3; i++) row[o + i] = Math.round(BG[i] * (1 - f) + FG[i] * f)
      row[o + 3] = Math.round(a * 255)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

// The anvil in the unit square: face and horn, waist, base
function anvil(u, v) {
  const top = v > 0.34 && v < 0.46 && u > 0.30 && u < 0.78
  const horn = v > 0.34 && v < 0.46 && u > 0.16 && u <= 0.30 && (v - 0.34) < (u - 0.16) * 0.86
  const waist = v >= 0.46 && v < 0.58 && u > 0.42 && u < 0.66
  const base = v >= 0.58 && v < 0.68 && u > 0.32 && u < 0.76
  return top || horn || waist || base
}

const rounded = (u, v, r) => {
  const dx = Math.max(r - u, 0, u - (1 - r)), dy = Math.max(r - v, 0, v - (1 - r))
  return dx * dx + dy * dy <= r * r
}
const icon = (u, v) => !rounded(u, v, 0.22) ? 'out' : anvil(u, v) ? 'fg' : 'bg'

const dir = new URL('../src/renderer/src/assets/', import.meta.url)
// icon.png: installer, window, notification area (electron-builder wants 256 px or more)
writeFileSync(new URL('icon.png', dir), png(1024, icon))
// icon-64.png: the title bar
writeFileSync(new URL('icon-64.png', dir), png(64, icon))

const hex = c => '#' + c.map(x => x.toString(16).padStart(2, '0')).join('')
const p = n => Math.round(n * 256 * 100) / 100
writeFileSync(new URL('icon.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="${p(0.22)}" fill="${hex(BG)}"/>
  <g fill="${hex(FG)}">
    <polygon points="${p(0.16)},${p(0.34)} ${p(0.78)},${p(0.34)} ${p(0.78)},${p(0.46)} ${p(0.30)},${p(0.46)}"/>
    <rect x="${p(0.42)}" y="${p(0.46)}" width="${p(0.24)}" height="${p(0.12)}"/>
    <rect x="${p(0.32)}" y="${p(0.58)}" width="${p(0.44)}" height="${p(0.10)}"/>
  </g>
</svg>
`)
console.log('Icons written to src/renderer/src/assets/')
