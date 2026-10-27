import type { Framework, ProjectSetup } from '../types'
import { AUTH_PAGES } from '../data/authContract'

/**
 * v3.4 lot 1: the page a project created by DevForge opens on, in place of
 * the framework's. Pure: the summary lists the same files the setup writes.
 * Self-contained (its CSS inside, no library), it covers the whole window so
 * the template's own styles cannot get in its way, and follows the system's
 * light or dark theme.
 */

export interface WelcomeInfo {
  name: string
  framework: Framework
  setup: ProjectSetup
  /** Tailwind set up by DevForge or the template */
  tailwind: boolean
  lang: 'fr' | 'en'
}

/** Frameworks DevForge writes a welcome page for */
export const WELCOME_FRAMEWORKS: Framework[] = ['nextjs', 'react', 'vue', 'nodejs', 'symfony', 'laravel']

const LABEL: Partial<Record<Framework, string>> = {
  nextjs: 'Next.js', react: 'React', vue: 'Vue', nodejs: 'Node.js', symfony: 'Symfony', laravel: 'Laravel'
}

const DOCS: Partial<Record<Framework, string>> = {
  nextjs: 'https://nextjs.org/docs', react: 'https://react.dev/learn', vue: 'https://vuejs.org/guide/introduction.html',
  nodejs: 'https://nodejs.org/docs/latest/api/', symfony: 'https://symfony.com/doc/current/index.html', laravel: 'https://laravel.com/docs'
}

/** The file to edit first, named on the page */
const ENTRY: Partial<Record<Framework, string>> = {
  nextjs: '{app}/page.tsx', react: 'src/App.tsx', vue: 'src/App.vue', nodejs: 'index.js',
  symfony: 'src/Controller/HomeController.php', laravel: 'resources/views/welcome.blade.php'
}

const TEXT = {
  fr: {
    ready: 'prêt', online: 'en ligne', what: 'Ce qui est en place', next: 'Pour continuer',
    login: 'Se connecter', register: 'Créer un compte', app: 'app', base: 'base', branch: 'branche',
    edit: 'Modifiez {file} pour remplacer cette page.', docs: 'Documentation {fw}', health: 'Route de santé {path}',
    db: { postgres: 'Base PostgreSQL', mysql: 'Base MySQL', sqlite: 'Base SQLite' } as Record<string, string>,
    docker: ' (Docker)', api: 'Première route d\'API', auth: 'Connexion et inscription', dockerApp: 'Docker pour l\'application',
    tests: 'Tests', ci: 'CI GitHub Actions', git: 'Dépôt Git (branche main)', tailwind: 'Tailwind CSS', nothing: 'Le projet de base, prêt à recevoir votre code'
  },
  en: {
    ready: 'ready', online: 'online', what: 'What is set up', next: 'Next steps',
    login: 'Sign in', register: 'Create an account', app: 'app', base: 'database', branch: 'branch',
    edit: 'Edit {file} to replace this page.', docs: '{fw} documentation', health: 'Health route {path}',
    db: { postgres: 'PostgreSQL database', mysql: 'MySQL database', sqlite: 'SQLite database' } as Record<string, string>,
    docker: ' (Docker)', api: 'First API route', auth: 'Sign-in and sign-up', dockerApp: 'Docker for the app',
    tests: 'Tests', ci: 'GitHub Actions CI', git: 'Git repository (main branch)', tailwind: 'Tailwind CSS', nothing: 'The base project, ready for your code'
  }
}

/** Where the sign-in and sign-up pages are (v3.4 lots 3 to 6); React and Vue route by the hash */
const SERVER_PAGES: [string, string] = [AUTH_PAGES.login, AUTH_PAGES.register]
const HASH_PAGES: [string, string] = [`#${AUTH_PAGES.login}`, `#${AUTH_PAGES.register}`]
const AUTH_LINKS: Partial<Record<Framework, [string, string]>> = {
  nextjs: SERVER_PAGES, laravel: SERVER_PAGES, symfony: SERVER_PAGES, react: HASH_PAGES, vue: HASH_PAGES
}

/** Where the app answers in development */
const APP_ADDRESS: Partial<Record<Framework, string>> = {
  nextjs: 'localhost:3000', react: 'localhost:5173', vue: 'localhost:5173', nodejs: 'localhost:3000', symfony: 'localhost:8000', laravel: 'localhost:8000'
}

const MONO = '"Geist Mono Variable","Geist Mono","Cascadia Code",Consolas,monospace'

/** DevForge's app colors and its anvil's orange, as the v3.4 mock-up B (dark, as the app) */
const CSS = `.df-welcome{position:fixed;inset:0;overflow:auto;z-index:0;display:flex;flex-direction:column;box-sizing:border-box;text-align:left;
background:#0D0F13;color:#E8ECF2;font:14px/1.6 "Geist Variable","Geist","Segoe UI",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.df-welcome *{box-sizing:border-box}
.df-welcome a{color:#E8ECF2;text-decoration:none}
.df-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 28px;border-bottom:1px solid #1F242D;background:#111419}
.df-brand{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600}
.df-brand span{font:500 12px ${MONO};color:#6B7584}
.df-nav{display:flex;align-items:center;gap:8px}
.df-btn{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:9px;border:1px solid #262C36;background:#1D222B;font-size:13px;font-weight:500;transition:box-shadow .15s}
.df-btn:hover{box-shadow:inset 0 0 0 100px rgba(255,255,255,.07)}
.df-welcome .df-primary{background:#F97316;border-color:#F97316;color:#1A0E04;font-weight:600}
.df-body{flex:1;display:flex;flex-wrap:wrap}
.df-side{flex:1 1 260px;max-width:320px;min-width:0;padding:28px;border-right:1px solid #1F242D;background:#111419;display:flex;flex-direction:column;gap:16px}
.df-icon{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;background:#2A1A0C;border:1px solid #5A3214;color:#F97316;font:600 20px ${MONO}}
.df-welcome h1{margin:0;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
.df-sub{margin:0;font:500 12.5px ${MONO};color:#9AA4B2}
.df-pill{align-self:flex-start;font:500 11px ${MONO};color:#3FCF8E;background:#10261C;padding:4px 10px;border-radius:999px}
.df-info{display:flex;flex-direction:column;gap:8px;font:500 12px ${MONO};color:#9AA4B2}
.df-info div{display:flex;justify-content:space-between;gap:12px}.df-info b{font-weight:500;color:#C9D1DC}
.df-tags{display:flex;flex-wrap:wrap;gap:6px}
.df-tags span{font:500 11px ${MONO};color:#9AA4B2;background:#1D222B;border:1px solid #262C36;padding:2px 8px;border-radius:6px}
.df-main{flex:999 1 560px;min-width:0;max-width:1040px;padding:28px;display:flex;flex-direction:column;gap:16px}
.df-card{padding:20px;border-radius:14px;background:#161A21;border:1px solid #222833;display:flex;flex-direction:column;gap:12px}
.df-welcome h2{margin:0;font:500 11px ${MONO};letter-spacing:.1em;text-transform:uppercase;color:#9AA4B2}
.df-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;font-size:13px}
.df-tiles div{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:#1D222B}
.df-tiles div::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#3FCF8E}
.df-row{display:flex;flex-wrap:wrap;gap:8px}
.df-foot{margin:0;font-size:12.5px;color:#9AA4B2;line-height:1.5}
.df-foot code{font:500 12px ${MONO};color:#C9D1DC;background:#1D222B;border-radius:5px;padding:1px 6px}
@media (max-width:720px){.df-side{max-width:none;border-right:0;border-bottom:1px solid #1F242D}}`

/** DevForge's anvil, the app's own logo */
const ANVIL = '<svg width="28" height="28" viewBox="0 0 256 256" aria-hidden="true"><rect width="256" height="256" rx="56" fill="#0F1117"></rect><g fill="#F97316"><polygon points="41,87 200,87 200,118 77,118"></polygon><rect x="108" y="118" width="61" height="31"></rect><rect x="82" y="148" width="113" height="26"></rect></g></svg>'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')

/** What the page lists as set up, from the creation's choices */
export function welcomeItems(info: WelcomeInfo): string[] {
  const t = TEXT[info.lang], s = info.setup, items: string[] = []
  if (s.database !== 'none') items.push(t.db[s.database] + (s.database !== 'sqlite' ? t.docker : ''))
  if (s.features.includes('api')) items.push(t.api)
  if (s.features.includes('auth')) items.push(t.auth)
  if (info.tailwind) items.push(t.tailwind)
  if (s.features.includes('docker')) items.push(t.dockerApp)
  if (s.features.includes('tests')) items.push(t.tests)
  if (s.features.includes('ci')) items.push(t.ci)
  if (s.git) items.push(t.git)
  return items.length ? items : [t.nothing]
}

/** The framework's mark in the page's icon */
const SHORT: Partial<Record<Framework, string>> = { nextjs: 'N', react: 'Re', vue: 'V', nodejs: 'JS', symfony: 'Sf', laravel: 'L' }

/** The page's markup, in HTML (class) or JSX (className) */
function markup(info: WelcomeInfo, jsx: boolean): string {
  const t = TEXT[info.lang], fw = LABEL[info.framework] ?? info.framework, s = info.setup
  const cls = jsx ? 'className' : 'class'
  const link = (kind: string, href: string, label: string) =>
    `<a ${cls}="df-btn${kind}" href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>${esc(label)}</a>`
  const auth = s.features.includes('auth') ? AUTH_LINKS[info.framework] : undefined
  const sail = info.framework === 'laravel' && s.features.includes('docker')
  const address = sail ? `localhost:${s.appPort ?? 8000}` : APP_ADDRESS[info.framework] ?? ''
  const base = s.database === 'none' ? '' : s.database === 'sqlite' ? 'sqlite' : `${s.database} :${s.dbPort}`
  const info2: [string, string][] = [[t.app, address], ...(base ? [[t.base, base] as [string, string]] : []), ...(s.git ? [[t.branch, 'main'] as [string, string]] : [])]
  const tags = [...(info.tailwind ? ['tailwind'] : []), ...(s.features.includes('docker') ? ['docker'] : []), ...(s.features.includes('tests') ? ['tests'] : []), ...(s.features.includes('ci') ? ['ci'] : [])]
  const health = info.framework === 'laravel' ? '/up' : '/api/health'
  const links: [string, string][] = [[DOCS[info.framework] ?? '#', t.docs.replace('{fw}', fw)], ...(s.features.includes('api') ? [[health, t.health.replace('{path}', health)] as [string, string]] : [])]
  const file = (ENTRY[info.framework] ?? '').replace('{app}/', 'app/')
  const [before, after] = t.edit.split('{file}')
  return [
    `<main ${cls}="df-welcome">`,
    `  <header ${cls}="df-bar">`,
    `    <div ${cls}="df-brand">${ANVIL}DevForge<span>/ ${esc(info.name)}</span></div>`,
    ...(auth ? [`    <nav ${cls}="df-nav">${link('', auth[0], t.login)}${link(' df-primary', auth[1], t.register)}</nav>`] : []),
    '  </header>',
    `  <div ${cls}="df-body">`,
    `    <aside ${cls}="df-side">`,
    `      <div ${cls}="df-icon">${esc(SHORT[info.framework] ?? '')}</div>`,
    `      <div><h1>${esc(info.name)}</h1><p ${cls}="df-sub">${esc(fw)} · ${esc(t.ready)}</p></div>`,
    `      <span ${cls}="df-pill">● ${esc(t.online)}</span>`,
    `      <div ${cls}="df-info">${info2.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`,
    ...(tags.length ? [`      <div ${cls}="df-tags">${tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>`] : []),
    '    </aside>',
    `    <div ${cls}="df-main">`,
    `      <section ${cls}="df-card">`,
    `        <h2>${esc(t.what)}</h2>`,
    `        <div ${cls}="df-tiles">${welcomeItems(info).map(i => `<div>${esc(i)}</div>`).join('')}</div>`,
    '      </section>',
    `      <section ${cls}="df-card">`,
    `        <h2>${esc(t.next)}</h2>`,
    `        <div ${cls}="df-row">${links.map(([href, label]) => link('', href, label)).join('')}</div>`,
    `        <p ${cls}="df-foot">${esc(before)}<code>${esc(file)}</code>${esc(after)}</p>`,
    '      </section>',
    '    </div>',
    '  </div>',
    '</main>'
  ].join('\n')
}

/** A whole HTML document (Symfony, Laravel, Node) */
export function welcomeDocument(info: WelcomeInfo): string {
  return [
    '<!doctype html>',
    `<html lang="${info.lang}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(info.name)}</title>`,
    `<style>${CSS}</style>`,
    '</head>',
    '<body>',
    markup(info, false),
    '</body>',
    '</html>',
    ''
  ].join('\n')
}

const indent = (text: string, by: string) => text.split('\n').map(l => l ? by + l : l).join('\n')

/** The files that make the page, per framework; {app} resolved by the main process */
export function welcomeFiles(info: WelcomeInfo, typescript: boolean): { path: string; content: string }[] {
  const style = `const css = \`${CSS}\``
  switch (info.framework) {
    case 'nextjs':
      return [{ path: `{app}/page.${typescript ? 'tsx' : 'jsx'}`, content: `${style}\n\nexport default function Home() {\n  return (\n    <>\n      <style>{css}</style>\n${indent(markup(info, true), '      ')}\n    </>\n  )\n}\n` }]
    case 'react':
      return [{ path: `src/App.${typescript ? 'tsx' : 'jsx'}`, content: `${style}\n\nexport default function App() {\n  return (\n    <>\n      <style>{css}</style>\n${indent(markup(info, true), '      ')}\n    </>\n  )\n}\n` }]
    case 'vue':
      return [{ path: 'src/App.vue', content: `<template>\n${indent(markup(info, false), '  ')}\n</template>\n\n<style>\n${CSS}\n</style>\n` }]
    case 'nodejs':
      return [{ path: 'index.js', content: nodeServer(info) }]
    case 'symfony':
      return [{ path: 'src/Controller/HomeController.php', content: symfonyController(info) }]
    case 'laravel':
      return [{ path: 'resources/views/welcome.blade.php', content: welcomeDocument(info) }]
    default:
      return []
  }
}

/** Node: the page on http://localhost:3000, with Node's own http module */
function nodeServer(info: WelcomeInfo): string {
  return [
    "const http = require('http')",
    '',
    'const port = Number(process.env.PORT) || 3000',
    `const page = ${JSON.stringify(welcomeDocument(info))}`,
    '',
    'http.createServer((req, res) => {',
    "  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })",
    '  res.end(page)',
    '}).listen(port, () => {',
    "  console.log('Ready on http://localhost:' + port)",
    '})',
    ''
  ].join('\n')
}

/** Symfony: a controller on / that answers the page itself (no Twig needed) */
function symfonyController(info: WelcomeInfo): string {
  return `<?php

namespace App\\Controller;

use Symfony\\Component\\HttpFoundation\\Response;
use Symfony\\Component\\Routing\\Attribute\\Route;

final class HomeController
{
    #[Route('/', name: 'home', methods: ['GET'])]
    public function __invoke(): Response
    {
        return new Response(<<<'HTML'
${welcomeDocument(info)}HTML);
    }
}
`
}
