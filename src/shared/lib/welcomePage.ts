import type { Framework, ProjectSetup } from '../types'
import { AUTH_PAGES } from '../data/authContract'
import { ANVIL, DEVFORGE_CSS } from './devforgeStyle'

/**
 * v3.4 lot 1, 3.4.1: the page a project created by DevForge opens on, in place
 * of the framework's. Pure: the summary lists the same files the setup writes.
 * Views hold markup only: the look is the project's devforge.css, and on
 * Symfony a controller renders a Twig view. With authentication the top bar
 * knows who is signed in (Twig app.user, Blade @auth, /api/auth/me elsewhere).
 */

export interface WelcomeInfo {
  name: string
  framework: Framework
  setup: ProjectSetup
  /** Tailwind set up by DevForge or the template */
  tailwind: boolean
  lang: 'fr' | 'en'
  /** TypeScript project (React, Vue, Next.js) */
  typescript?: boolean
}

/** Frameworks DevForge writes a welcome page for (Node has no page: an API or a script) */
export const WELCOME_FRAMEWORKS: Framework[] = ['nextjs', 'react', 'vue', 'symfony', 'laravel']

const LABEL: Partial<Record<Framework, string>> = {
  nextjs: 'Next.js', react: 'React', vue: 'Vue', symfony: 'Symfony', laravel: 'Laravel'
}

const DOCS: Partial<Record<Framework, string>> = {
  nextjs: 'https://nextjs.org/docs', react: 'https://react.dev/learn', vue: 'https://vuejs.org/guide/introduction.html',
  symfony: 'https://symfony.com/doc/current/index.html', laravel: 'https://laravel.com/docs'
}

/** The view to edit, named on the page */
const VIEW: Partial<Record<Framework, string>> = {
  nextjs: '{app}/page.tsx', react: 'src/pages/Home.tsx', vue: 'src/pages/Home.vue',
  symfony: 'templates/home/index.html.twig', laravel: 'resources/views/welcome.blade.php'
}

/** Where devforge.css lives in each project */
export const STYLESHEET: Partial<Record<Framework, string>> = {
  nextjs: '{app}/devforge.css', react: 'src/styles/devforge.css', vue: 'src/styles/devforge.css',
  symfony: 'public/devforge.css', laravel: 'public/devforge.css'
}

const TEXT = {
  fr: {
    ready: 'prêt', online: 'en ligne', what: 'Ce qui est en place', next: 'Pour continuer',
    login: 'Se connecter', register: 'Créer un compte', dashboard: 'Tableau de bord', logout: 'Se déconnecter',
    app: 'app', base: 'base', branch: 'branche',
    edit: 'Modifiez {file} pour remplacer cette page.', docs: 'Documentation {fw}', health: 'Route de santé {path}',
    db: { postgres: 'Base PostgreSQL', mysql: 'Base MySQL', sqlite: 'Base SQLite' } as Record<string, string>,
    docker: ' (Docker)', api: 'Première route d\'API', auth: 'Connexion et inscription', dockerApp: 'Docker pour l\'application',
    tests: 'Tests', ci: 'CI GitHub Actions', git: 'Dépôt Git (branche main)', tailwind: 'Tailwind CSS', nothing: 'Le projet de base, prêt à recevoir votre code'
  },
  en: {
    ready: 'ready', online: 'online', what: 'What is set up', next: 'Next steps',
    login: 'Sign in', register: 'Create an account', dashboard: 'Dashboard', logout: 'Sign out',
    app: 'app', base: 'database', branch: 'branch',
    edit: 'Edit {file} to replace this page.', docs: '{fw} documentation', health: 'Health route {path}',
    db: { postgres: 'PostgreSQL database', mysql: 'MySQL database', sqlite: 'SQLite database' } as Record<string, string>,
    docker: ' (Docker)', api: 'First API route', auth: 'Sign-in and sign-up', dockerApp: 'Docker for the app',
    tests: 'Tests', ci: 'GitHub Actions CI', git: 'Git repository (main branch)', tailwind: 'Tailwind CSS', nothing: 'The base project, ready for your code'
  }
}
type T = typeof TEXT.fr

/** Where the app answers in development */
const APP_ADDRESS: Partial<Record<Framework, string>> = {
  nextjs: 'localhost:3000', react: 'localhost:5173', vue: 'localhost:5173', symfony: 'localhost:8000', laravel: 'localhost:8000'
}

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
const SHORT: Partial<Record<Framework, string>> = { nextjs: 'N', react: 'Re', vue: 'V', symfony: 'Sf', laravel: 'L' }

type Engine = 'jsx' | 'vue' | 'twig' | 'blade'

/** The top bar knows who is signed in when the project has DevForge's authentication (TypeScript fronts, PHP servers) */
export const accountAware = (info: WelcomeInfo) =>
  info.setup.features.includes('auth') && (info.framework === 'symfony' || info.framework === 'laravel' || !!info.typescript)

const btn = (cls: string, kind: string, href: string, label: string) =>
  `<a ${cls}="df-btn${kind}" href="${href}">${esc(label)}</a>`

/** The account links: per template engine, or a component asking /api/auth/me */
function accountNav(info: WelcomeInfo, engine: Engine, t: T): string[] {
  if (!info.setup.features.includes('auth')) return []
  const cls = engine === 'jsx' ? 'className' : 'class'
  if (!accountAware(info)) {
    // Next.js in JavaScript keeps Auth.js: plain links
    return [`    <nav ${cls}="df-nav">${btn(cls, '', AUTH_PAGES.login, t.login)}${btn(cls, ' df-primary', AUTH_PAGES.register, t.register)}</nav>`]
  }
  if (engine === 'twig') {
    return [
      '    <nav class="df-nav">',
      '      {% if app.user %}',
      `        <a class="df-btn" href="{{ path('app_dashboard') }}">${esc(t.dashboard)}</a>`,
      `        <a class="df-btn" href="{{ path('app_logout') }}">${esc(t.logout)}</a>`,
      '      {% else %}',
      `        <a class="df-btn" href="{{ path('app_login') }}">${esc(t.login)}</a>`,
      `        <a class="df-btn df-primary" href="{{ path('app_register') }}">${esc(t.register)}</a>`,
      '      {% endif %}',
      '    </nav>'
    ]
  }
  if (engine === 'blade') {
    return [
      '    <nav class="df-nav">',
      '      @auth',
      `        <a class="df-btn" href="{{ route('dashboard') }}">${esc(t.dashboard)}</a>`,
      `        <form method="POST" action="{{ route('logout') }}">`,
      '          @csrf',
      `          <button class="df-btn" type="submit">${esc(t.logout)}</button>`,
      '        </form>',
      '      @else',
      `        <a class="df-btn" href="{{ route('login') }}">${esc(t.login)}</a>`,
      `        <a class="df-btn df-primary" href="{{ route('register') }}">${esc(t.register)}</a>`,
      '      @endauth',
      '    </nav>'
    ]
  }
  return ['    <AccountNav />']
}

/** The page's markup for a template engine */
function markup(info: WelcomeInfo, engine: Engine): string {
  const t = TEXT[info.lang], fw = LABEL[info.framework] ?? info.framework, s = info.setup
  const cls = engine === 'jsx' ? 'className' : 'class'
  const sail = info.framework === 'laravel' && s.features.includes('docker')
  const address = sail ? `localhost:${s.appPort ?? 8000}` : APP_ADDRESS[info.framework] ?? ''
  const base = s.database === 'none' ? '' : s.database === 'sqlite' ? 'sqlite' : `${s.database} :${s.dbPort}`
  const facts: [string, string][] = [[t.app, address], ...(base ? [[t.base, base] as [string, string]] : []), ...(s.git ? [[t.branch, 'main'] as [string, string]] : [])]
  const tags = [...(info.tailwind ? ['tailwind'] : []), ...(s.features.includes('docker') ? ['docker'] : []), ...(s.features.includes('tests') ? ['tests'] : []), ...(s.features.includes('ci') ? ['ci'] : [])]
  const health = info.framework === 'laravel' ? '/up' : '/api/health'
  const docs = DOCS[info.framework] ?? '#'
  const file = (VIEW[info.framework] ?? '').replace('{app}/', 'app/')
  const [before, after] = t.edit.split('{file}')
  return [
    `<main ${cls}="df-welcome">`,
    `  <header ${cls}="df-bar">`,
    `    <div ${cls}="df-brand">${ANVIL}DevForge<span>/ ${esc(info.name)}</span></div>`,
    ...accountNav(info, engine, t),
    '  </header>',
    `  <div ${cls}="df-body">`,
    `    <aside ${cls}="df-side">`,
    `      <div ${cls}="df-icon">${esc(SHORT[info.framework] ?? '')}</div>`,
    `      <div><h1>${esc(info.name)}</h1><p ${cls}="df-sub">${esc(fw)} · ${esc(t.ready)}</p></div>`,
    `      <span ${cls}="df-pill">● ${esc(t.online)}</span>`,
    `      <div ${cls}="df-info">${facts.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`,
    ...(tags.length ? [`      <div ${cls}="df-tags">${tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>`] : []),
    '    </aside>',
    `    <div ${cls}="df-main">`,
    `      <section ${cls}="df-card">`,
    `        <h2>${esc(t.what)}</h2>`,
    `        <div ${cls}="df-tiles">${welcomeItems(info).map(i => `<div>${esc(i)}</div>`).join('')}</div>`,
    '      </section>',
    `      <section ${cls}="df-card">`,
    `        <h2>${esc(t.next)}</h2>`,
    `        <div ${cls}="df-row"><a ${cls}="df-btn" href="${docs}" target="_blank" rel="noreferrer">${esc(t.docs.replace('{fw}', fw))}</a>${s.features.includes('api') ? btn(cls, '', health, t.health.replace('{path}', health)) : ''}</div>`,
    `        <p ${cls}="df-foot">${esc(before)}<code>${esc(file)}</code>${esc(after)}</p>`,
    '      </section>',
    '    </div>',
    '  </div>',
    '</main>'
  ].join('\n')
}

/** A whole HTML document for a server view (Twig, Blade), devforge.css linked */
function serverDocument(info: WelcomeInfo, engine: 'twig' | 'blade'): string {
  const css = engine === 'blade' ? "{{ asset('devforge.css') }}" : '/devforge.css'
  return [
    '<!doctype html>',
    `<html lang="${info.lang}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(info.name)}</title>`,
    `<link rel="stylesheet" href="${css}">`,
    '</head>',
    '<body>',
    markup(info, engine),
    '</body>',
    '</html>',
    ''
  ].join('\n')
}

const indent = (text: string, by: string) => text.split('\n').map(l => l ? by + l : l).join('\n')

/** A React component (Next.js page or Vite page) */
function jsxComponent(name: string, info: WelcomeInfo, imports: string[]): string {
  return `${imports.join('\n')}\n\n/** DevForge's welcome page: the look is in devforge.css */\nexport default function ${name}() {\n  return (\n${indent(markup(info, 'jsx'), '    ')}\n  )\n}\n`
}

const SYMFONY_CONTROLLER = String.raw`<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** The welcome page: the route here, the view in templates/home/index.html.twig */
final class HomeController extends AbstractController
{
    #[Route('/', name: 'home', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('home/index.html.twig');
    }
}
`

/** The files that make the page, per framework; {app} resolved by the main process */
export function welcomeFiles(input: WelcomeInfo, typescript: boolean): { path: string; content: string }[] {
  const info = { ...input, typescript }
  const ext = typescript ? 'tsx' : 'jsx'
  const live = accountAware(info)
  const stylesheet = { path: STYLESHEET[info.framework] ?? '', content: DEVFORGE_CSS }
  switch (info.framework) {
    case 'nextjs':
      return [
        { path: `{app}/page.${ext}`, content: jsxComponent('Home', info, ["import './devforge.css'", ...(live ? ["import AccountNav from './account-nav'"] : [])]) },
        stylesheet
      ]
    case 'react':
      return [
        { path: `src/pages/Home.${ext}`, content: jsxComponent('Home', info, ["import '../styles/devforge.css'", ...(live ? ["import AccountNav from '../components/AccountNav'"] : [])]) },
        { path: `src/App.${ext}`, content: `/** The app's first page: DevForge's welcome (src/pages/Home) */\nexport { default } from './pages/Home'\n` },
        stylesheet
      ]
    case 'vue': {
      const lang = typescript ? ' lang="ts"' : ''
      return [
        { path: 'src/pages/Home.vue', content: `<script setup${lang}>\nimport '../styles/devforge.css'\n${live ? "import AccountNav from '../components/AccountNav.vue'\n" : ''}</script>\n\n<template>\n${indent(markup(info, 'vue'), '  ')}\n</template>\n` },
        { path: 'src/App.vue', content: `<script setup${lang}>\n// The app's first page: DevForge's welcome (src/pages/Home.vue)\nimport Home from './pages/Home.vue'\n</script>\n\n<template>\n  <Home />\n</template>\n` },
        stylesheet
      ]
    }
    case 'symfony':
      return [
        { path: 'src/Controller/HomeController.php', content: SYMFONY_CONTROLLER },
        { path: 'templates/home/index.html.twig', content: serverDocument(info, 'twig') },
        stylesheet
      ]
    case 'laravel':
      return [
        { path: 'resources/views/welcome.blade.php', content: serverDocument(info, 'blade') },
        stylesheet
      ]
    default:
      return []
  }
}
