// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

const group = (label, en, items) => ({ label, translations: { en }, items })

// Published by GitHub Pages at https://victhille.github.io/devforge/
export default defineConfig({
  site: 'https://victhille.github.io',
  base: '/devforge',
  integrations: [
    starlight({
      title: 'DevForge',
      description: "L'atelier de dev sur Windows : projets, Git, Docker, serveurs, bases de données et un assistant IA.",
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Français', lang: 'fr' },
        en: { label: 'English', lang: 'en' }
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/victhille/devforge' }],
      editLink: { baseUrl: 'https://github.com/victhille/devforge/edit/main/site/' },
      customCss: ['@fontsource-variable/geist', '@fontsource-variable/geist-mono', './src/styles/custom.css'],
      lastUpdated: true,
      // Light by default, the home page's download button in the header
      components: { ThemeProvider: './src/components/ThemeProvider.astro', SocialIcons: './src/components/SocialIcons.astro', Head: './src/components/Head.astro', Header: './src/components/Header.astro', Footer: './src/components/Footer.astro' },
      // src/pages/404.astro, in the look of the home page
      disable404Route: true,
      // Code on the app's dark canvas in both themes
      expressiveCode: { themes: ['github-dark-default'] },
      // The documentation only: the other pages are tabs under the header (src/components/sections.ts)
      sidebar: [
        group('Prise en main', 'Getting started', [
          'getting-started/installation',
          'getting-started/first-launch',
          'getting-started/connections',
          'getting-started/interface'
        ]),
        group('Guides', 'Guides', ['guides/deploy-site', 'guides/sqlite', 'guides/forgy-commit']),
        group('Développement', 'Development', [
          'dev/projects', 'dev/new-project', 'dev/git', 'dev/stacks', 'dev/docker'
        ]),
        group('Serveurs', 'Servers', [
          'servers/ssh', 'servers/health', 'servers/services', 'servers/backups', 'servers/monitoring'
        ]),
        group('Mise en ligne', 'Going live', [
          'online/deploy', 'online/n8n', 'online/vpn', 'online/status-page'
        ]),
        group('Données & API', 'Data & API', [
          'data/database', 'data/api-tester', 'data/webhooks', 'data/logs'
        ]),
        group('Système', 'System', [
          'system/environment', 'system/ports', 'system/env-files', 'system/domains', 'system/cleaner'
        ]),
        group('Outils', 'Tools', ['tools/utilities']),
        group('Forgy', 'Forgy', ['forgy/assistant', 'forgy/actions', 'forgy/desktop']),
        group('Paramètres', 'Settings', ['settings/general', 'settings/data']),
        'developers'
      ]
    })
  ]
})
