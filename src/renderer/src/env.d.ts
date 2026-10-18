/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** Short git commit of the build, "dev" outside a git checkout */
declare const __APP_COMMIT__: string
/** ISO date of the build */
declare const __BUILD_DATE__: string
/** Release notes at build time, per UI language (CHANGELOG.md, CHANGELOG.en.md) */
declare const __CHANGELOGS__: Record<'fr' | 'en', string>
