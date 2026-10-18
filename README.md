# DevForge

Application de bureau (Electron + React) qui regroupe les outils de dev du quotidien : projets, Git, Docker / Compose, SSH et VPS, bases de données, déploiements, monitoring, `.env`, domaines locaux, boîte à outils.

## Développer

```bash
npm install
npm run dev        # app avec rechargement à chaud
npm run check      # types + lint + tests + build (comme la CI)
npm test           # tests seuls (Vitest) ; npm run test:watch en continu
npm run dist       # installeur Windows dans dist/
```

## Versions

Versions SemVer, commits conventionnels, `npm run release` pour publier : voir [docs/VERSIONS.md](docs/VERSIONS.md).
