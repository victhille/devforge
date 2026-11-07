// /admin: DevForge's audience, read from GitHub with the owner's token.
// Everything is built with textContent: titles and referrers come from outside.
import { mergeDays, releaseCounts } from './stats-core.js'

const OWNER = 'victhille'
const REPO = `${OWNER}/devforge`
/** Private: only the owner's token can read it */
const ARCHIVE = `${OWNER}/devforge-stats`
const KEY = 'devforge-admin-token'

const $ = id => document.getElementById(id)
const nf = new Intl.NumberFormat('fr-FR')
const n = v => nf.format(v)
/** "1 visiteur", "2 visiteurs" */
const count = (v, word) => `${n(v)} ${word}${v > 1 ? 's' : ''}`
const day = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v
    else if (v !== false && v !== undefined) el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c))
  return el
}
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

// ─── Token ──────────────────────────────────────────────────────────────────

const storage = {
  get: () => { try { return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY) } catch { return null } },
  set: (t, remember) => { try { (remember ? localStorage : sessionStorage).setItem(KEY, t) } catch { /* private window */ } },
  clear: () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY) } catch { /* nothing kept */ } }
}

async function gh(token, path, raw = false) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    cache: 'no-store'
  })
  if (!res.ok) { const e = new Error(`GitHub ${res.status}`); e.status = res.status; throw e }
  return raw ? JSON.parse(await res.text()) : res.json()
}
/** null for what this token may not read (the traffic, the archive before its first run) */
const maybe = p => p.catch(e => { if (e.status === 403 || e.status === 404) return null; throw e })

// ─── Charts ─────────────────────────────────────────────────────────────────

const tip = $('tip')
function hover(el, text) {
  el.addEventListener('mousemove', e => {
    const t = text(e)
    if (!t) { tip.hidden = true; return }
    tip.textContent = t
    tip.hidden = false
    const left = e.clientX + 12 + tip.offsetWidth > innerWidth ? e.clientX - tip.offsetWidth - 12 : e.clientX + 12
    tip.style.left = `${left}px`
    tip.style.top = `${e.clientY - 34}px`
  })
  el.addEventListener('mouseleave', () => { tip.hidden = true })
}

/** A smooth path through the points that never overshoots (monotone cubic): no dip below zero between two days */
function smooth(pts) {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')
  const d = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]))
  const m = pts.map((_, i) => i === 0 ? d[0] : i === pts.length - 1 ? d[i - 1] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  for (let i = 0; i < d.length; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  let path = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < d.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = (x1 - x0) / 3
    path += `C${(x0 + dx).toFixed(1)},${(y0 + m[i] * dx).toFixed(1)} ${(x1 - dx).toFixed(1)},${(y1 - m[i + 1] * dx).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return path
}

/** A round top for the axis: 1, 2, 5 × 10ⁿ */
function niceTop(v) {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map(k => k * p).find(t => t >= v)
}

/**
 * Days as smooth areas: one or two series on one axis, a few round grid lines,
 * dates under it, a crosshair with every series' value on hover. Drawn at the
 * real width (text and strokes are never stretched) and again when it changes.
 */
function chart(dates, series, height = 180) {
  const box = h('div', { class: 'plot' })
  const legend = series.length > 1 && h('div', { class: 'legend' }, series.map(s => h('span', {}, h('i', { class: `key ${s.cls}` }), s.name)))
  const ro = new ResizeObserver(() => draw())
  const draw = () => {
    // Drawn again for another period: this one is gone
    if (!box.isConnected && box.firstChild) { ro.disconnect(); return }
    const W = box.clientWidth
    if (!W) return
    const L = 34, R = 8, T = 10, B = 24, H = height
    const top = niceTop(Math.max(0, ...series.flatMap(s => s.values)))
    const x = i => L + (dates.length === 1 ? (W - L - R) / 2 : (i / (dates.length - 1)) * (W - L - R))
    const y = v => T + (1 - v / top) * (H - T - B)
    const s = svg('svg', { width: W, height: H, role: 'img', 'aria-label': series.map(se => `${se.name} : au plus ${n(Math.max(...se.values))} par jour`).join(', ') })
    for (const k of [0, 0.5, 1]) {
      s.append(svg('line', { x1: L, x2: W - R, y1: y(top * k), y2: y(top * k), class: k ? 'grid' : 'base' }))
      const t = svg('text', { x: L - 8, y: y(top * k) + 4, class: 'tick', 'text-anchor': 'end' }); t.textContent = n(top * k); s.append(t)
    }
    // A date about every 70 px, the last one always
    const every = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor((W - L - R) / 70))))
    const lastX = x(dates.length - 1)
    dates.forEach((d, i) => {
      const end = i === dates.length - 1
      if (!end && (i % every || lastX - x(i) < 64)) return
      const t = svg('text', { x: x(i), y: H - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle' }); t.textContent = day(d); s.append(t)
    })
    for (const se of series) {
      const pts = se.values.map((v, i) => [x(i), y(v)])
      const line = smooth(pts)
      s.append(svg('path', { d: `${line}L${x(dates.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, class: `area ${se.cls}` }), svg('path', { d: line, class: `line ${se.cls}` }))
    }
    const cross = svg('line', { y1: T, y2: H - B, class: 'cross', visibility: 'hidden' })
    const dots = series.map(se => svg('circle', { r: 4.5, class: `dot ${se.cls}`, visibility: 'hidden' }))
    s.append(cross, ...dots)
    hover(s, e => {
      const px = e.clientX - s.getBoundingClientRect().left
      const i = Math.min(dates.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (dates.length - 1))))
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible')
      series.forEach((se, k) => { dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(se.values[i])); dots[k].setAttribute('visibility', 'visible') })
      return `${day(dates[i])} · ${series.map(se => `${se.short ?? se.name} ${n(se.values[i])}`).join(' · ')}`
    })
    s.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')) })
    box.replaceChildren(s)
  }
  ro.observe(box)
  return h('div', { class: series.length > 1 ? 'chart' : 'chart solo' }, legend, box)
}

/** Every day from the first to the last, a missing one at zero */
function continuous(days, from) {
  const by = new Map(days.map(d => [d.date, d]))
  const last = days.length ? days[days.length - 1].date : new Date().toISOString().slice(0, 10)
  const out = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += 864e5) {
    const date = new Date(t).toISOString().slice(0, 10)
    out.push(by.get(date) ?? { date, views: 0, uniques: 0, clones: 0, cloneUniques: 0 })
  }
  return out
}

const RANGES = [[14, '14 j'], [30, '30 j'], [90, '90 j'], [0, 'Tout']]
let range = 30

// ─── Page ───────────────────────────────────────────────────────────────────

const tile = (label, value, sub) => h('div', { class: 'card tile' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), h('div', { class: 'sub' }, sub))
const list = (title, rows, empty, note) => h('section', { class: 'card' }, h('h2', {}, title),
  rows.length ? h('ul', { class: 'list' }, rows.map(([a, b, full]) => h('li', {}, h('span', { title: full ?? a }, a), h('span', { class: 'num small' }, b)))) : h('p', { class: 'small' }, empty),
  note && h('p', { class: 'small' }, note))

function render(data) {
  const { repo, releases, views, clones, referrers, paths, archive } = data
  const versions = releaseCounts(releases)
  const downloads = versions.reduce((s, r) => s + r.downloads, 0)
  const checks = versions.reduce((s, r) => s + r.updateChecks, 0)
  const days = Object.entries(mergeDays(archive?.days, views?.views, clones?.clones)).map(([date, d]) => ({ date, ...d }))
  const snapshots = Object.entries(archive?.snapshots ?? {}).map(([date, s]) => ({ date, ...s })).sort((a, b) => a.date.localeCompare(b.date))
  const traffic = views !== null
  const refs = referrers ?? archive?.referrers ?? []
  const pages = paths ?? archive?.paths ?? []
  const top = Math.max(1, ...versions.map(r => r.downloads))
  // The chosen period, every day of it (GitHub leaves out the days without a visit)
  const lastDay = days.length ? days[days.length - 1].date : new Date().toISOString().slice(0, 10)
  // Nothing is known before the archive began (or before GitHub's 14 days): those days are not drawn as zeros
  const back = k => new Date(Date.parse(`${lastDay}T00:00:00Z`) - (k - 1) * 864e5).toISOString().slice(0, 10)
  const known = [archive?.since ?? back(14), days[0]?.date ?? lastDay].sort()[0]
  const start = [range ? back(range) : known, known].sort()[1]
  const shown = continuous(days.filter(d => d.date >= start), start)
  const sum = k => shown.reduce((s, d) => s + d[k], 0)

  const out = $('stats')
  out.replaceChildren(
    h('div', { class: 'tiles' },
      tile('Téléchargements', n(downloads), versions[0] ? `dont ${versions[0].tag} : ${n(versions[0].downloads)}` : 'aucune version publiée'),
      tile('Vérifications de mise à jour', n(checks), "une par lancement d'une copie installée"),
      tile('Visiteurs uniques (14 j)', traffic ? n(views.uniques) : '—', traffic ? `${n(views.count)} vues, toi compris` : 'trafic non lisible'),
      tile('Étoiles', n(repo.stargazers_count), `${n(repo.forks_count)} forks · ${n(repo.subscribers_count)} abonnés`)),
    h('div', { class: 'stack' },
      !traffic && h('p', { class: 'card note' }, "Ce jeton ne lit pas le trafic : il lui faut « Administration » en lecture sur devforge."),
      shown.length > 1 && h('section', { class: 'card' },
        h('div', { class: 'head' },
          h('h2', {}, 'Visites du dépôt', archive?.since && h('span', { class: 'small' }, ` · archivées depuis le ${longDate(archive.since)}`)),
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, RANGES.map(([d, label]) => {
            const b = h('button', { type: 'button', 'aria-pressed': String(range === d) }, label)
            b.addEventListener('click', () => { range = d; render(data) })
            return b
          }))),
        h('div', { class: 'sums' },
          h('span', {}, h('b', { class: 'num' }, n(Math.max(...shown.map(d => d.uniques)))), ' visiteurs au plus en un jour'),
          h('span', {}, h('b', { class: 'num' }, n(sum('views'))), ' vues')),
        // Unique visitors first: the owner counts once a day at most there, every page in the views
        chart(shown.map(d => d.date), [
          { name: 'Visiteurs uniques', short: 'visiteurs', cls: 's1', values: shown.map(d => d.uniques) },
          { name: 'Vues', short: 'vues', cls: 's2', values: shown.map(d => d.views) }
        ]),
        h('p', { class: 'small' }, "GitHub ne dit pas qui visite : tes propres passages sont inclus, au plus 1 visiteur unique par jour.")),
      // Where they come from: a visit from a search engine or a forum is never yours
      h('div', { class: 'grid2' },
        list("D'où viennent les visiteurs", refs.map(r => [r.referrer, `${count(r.uniques, 'visiteur')} · ${count(r.count, 'vue')}`]), 'Rien sur les 14 derniers jours.',
          refs.some(r => r.referrer === 'github.com') && "« github.com » regroupe les passages depuis GitHub lui-même, les tiens compris."),
        list('Pages les plus vues', pages.map(p => [p.path, `${count(p.uniques, 'visiteur')} · ${count(p.count, 'vue')}`, p.title]), 'Rien sur les 14 derniers jours.')),
      snapshots.length > 1 && h('section', { class: 'card' }, h('h2', {}, 'Dans le temps'),
        h('div', { class: 'grid2' },
          h('div', {}, h('h3', {}, 'Téléchargements au total'), chart(snapshots.map(s => s.date), [{ name: 'Téléchargements', short: 'téléchargements', cls: 's1', values: snapshots.map(s => s.downloads) }], 140)),
          h('div', {}, h('h3', {}, 'Étoiles'), chart(snapshots.map(s => s.date), [{ name: 'Étoiles', short: 'étoiles', cls: 's2', values: snapshots.map(s => s.stars) }], 140)))),
      !archive && h('p', { class: 'card note' }, "Pas encore d'archive : GitHub ne garde que 14 jours de visites. Le workflow « Stats » les ajoute chaque nuit dans le dépôt privé devforge-stats (docs/dev/stats.md)."),
      h('section', { class: 'card' }, h('h2', {}, 'Par version'),
        versions.length ? h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Version'), h('th', {}, 'Publiée'), h('th', { class: 'r' }, 'Téléchargements'), h('th', { class: 'r' }, 'Vérifications de mise à jour'))),
          h('tbody', {}, versions.map(r => {
            const meter = h('span', { class: 'meter', 'aria-hidden': 'true' }, h('span'))
            meter.firstChild.style.width = `${(r.downloads / top) * 100}%`
            return h('tr', {}, h('td', { class: 'mono' }, r.tag), h('td', {}, r.publishedAt ? longDate(r.publishedAt) : '—'),
              h('td', { class: 'r' }, meter, h('span', { class: 'num' }, n(r.downloads))), h('td', { class: 'r num' }, n(r.updateChecks)))
          }))) : h('p', { class: 'small' }, 'Aucune version publiée.')),
      h('p', { class: 'small' }, "Les installeurs comptent aussi les mises à jour qui reprennent le fichier entier, et tes propres installations (1 ou 2 par version). Les clones ne sont pas montrés : ce sont surtout GitHub Actions et tes git pull. Aucune donnée n'est envoyée par les copies installées.")))
  out.hidden = false
}

async function load(token) {
  $('status').textContent = 'Lecture de GitHub…'
  const t = p => maybe(gh(token, `/repos/${REPO}/traffic/${p}`))
  const [repo, releases, views, clones, referrers, paths, archive] = await Promise.all([
    gh(token, `/repos/${REPO}`), gh(token, `/repos/${REPO}/releases?per_page=100`),
    t('views'), t('clones'), t('popular/referrers'), t('popular/paths'),
    maybe(gh(token, `/repos/${ARCHIVE}/contents/stats.json`, true))
  ])
  render({ repo, releases, views, clones, referrers, paths, archive })
  $('status').textContent = archive?.updatedAt ? `Archive mise à jour le ${longDate(archive.updatedAt)}.` : ''
}

function showLogin(message = '') {
  $('stats').hidden = true
  $('who').replaceChildren()
  $('status').textContent = ''
  $('login').hidden = false
  $('login-error').textContent = message
  $('token').focus()
}

/** The owner, or nothing: another account's token is not kept */
async function signIn(token) {
  let user
  try { user = await gh(token, '/user') } catch (e) {
    storage.clear()
    return showLogin(e.status === 401 ? 'GitHub refuse ce jeton : il a peut-être expiré.' : `GitHub ne répond pas (${e.message}).`)
  }
  if (user.login.toLowerCase() !== OWNER) { storage.clear(); return showLogin(`Accès refusé : ${user.login} n'est pas le propriétaire de DevForge.`) }
  $('login').hidden = true
  const avatar = h('img', { src: user.avatar_url, alt: '' })
  const out = h('button', { type: 'button' }, 'Se déconnecter')
  out.addEventListener('click', () => { storage.clear(); showLogin() })
  $('who').replaceChildren(avatar, h('span', {}, user.login), out)
  try { await load(token) } catch (e) { $('status').textContent = `Lecture impossible : ${e.message}.` }
  return true
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault()
  const token = $('token').value.trim()
  $('token').value = ''
  if (await signIn(token)) storage.set(token, $('remember').checked)
})

const saved = storage.get()
if (saved) signIn(saved); else showLogin()
