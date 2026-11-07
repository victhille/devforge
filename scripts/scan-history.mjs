#!/usr/bin/env node
// Looks through the whole Git history (every version of every file, every
// commit message) for secrets and for the personal words of .personal-patterns
// / PERSONAL_PATTERNS. Prints where, never what (no secret in the output).
//
//   node scripts/scan-history.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const SECRETS = [
  ['github token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['anthropic key', /\bsk-ant-[A-Za-z0-9_-]{30,}/],
  ['openai key', /\bsk-(proj-)?[A-Za-z0-9]{32,}\b/],
  ['aws key', /\bAKIA[0-9A-Z]{16}\b/],
  ['google key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['private key', /-----BEGIN (RSA |OPENSSH |EC |DSA |)PRIVATE KEY-----/],
  ['vercel token', /\b[A-Za-z0-9]{24}\b(?=.*vercel)/i],
  ['password in a URL', /[a-z]+:\/\/[^\s:@/]+:[^\s@/]{6,}@(?!example|host|localhost|127\.|database)/i]
]
const SUSPECT_FILES = /(^|\/)(\.env(\.[a-z]+)?|id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx|credentials\.json)$/i

const raw = process.env.PERSONAL_PATTERNS ?? (existsSync('.personal-patterns') ? readFileSync('.personal-patterns', 'utf-8') : '')
const words = raw.split(/\r?\n|,/).map(w => w.trim()).filter(w => w && !w.startsWith('#')).map(w => w.toLowerCase())

const found = new Map()
const note = (what, where) => { const s = found.get(what) ?? new Set(); s.add(where); found.set(what, s) }
const scan = (text, where) => {
  for (const [name, re] of SECRETS) if (re.test(text)) note(`secret: ${name}`, where)
  const l = text.toLowerCase()
  words.forEach((w, k) => { if (l.includes(w)) note(`personal word #${k + 1}`, where) })
}

// Every path that ever existed, with its blob
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf-8', maxBuffer: 1 << 28 }).split('\n')
const blobs = new Map()
for (const line of objects) {
  const [sha, ...p] = line.split(' ')
  const path = p.join(' ')
  if (!sha || !path) continue
  if (SUSPECT_FILES.test(path) && !/\.example$|\.sample$/.test(path)) note('suspect file name', path)
  if (!blobs.has(sha)) blobs.set(sha, path)
}
const types = spawnSync('git', ['cat-file', '--batch-check'], { input: [...blobs.keys()].join('\n'), encoding: 'utf-8', maxBuffer: 1 << 28 }).stdout.split('\n')
for (const t of types) {
  const [sha, type, size] = t.split(' ')
  if (type !== 'blob' || Number(size) > 5_000_000) continue
  const text = execFileSync('git', ['cat-file', 'blob', sha], { encoding: 'utf-8', maxBuffer: 1 << 26 })
  if (text.includes('\u0000')) continue
  scan(text, blobs.get(sha))
}

// Commit messages and authors
const log = execFileSync('git', ['log', '--all', '--format=%H%x1f%an <%ae>%x1f%s%n%b%x1e'], { encoding: 'utf-8', maxBuffer: 1 << 28 })
for (const entry of log.split('\x1e')) {
  const [sha, author, msg] = entry.trim().split('\x1f')
  if (!sha) continue
  scan(msg ?? '', `commit ${sha.slice(0, 7)} (message)`)
  scan(author ?? '', `commit ${sha.slice(0, 7)} (author)`)
}

console.log(`${blobs.size} objects, ${words.length} personal words.`)
for (const [what, where] of [...found].sort()) console.log(`\n${what} — ${where.size} place(s)\n  ${[...where].slice(0, 25).join('\n  ')}${where.size > 25 ? '\n  …' : ''}`)
if (!found.size) console.log('✔ Nothing found.')
