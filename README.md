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

Les versions suivent [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`, avec des préversions possibles (`1.3.0-beta.1`).

Les messages de commit suivent [Conventional Commits](https://www.conventionalcommits.org/fr/). Ce sont eux qui décident de la version suivante et remplissent les notes de version :

| Commit | Exemple | Effet |
|---|---|---|
| `feat` | `feat(db): explorateur de tables` | version mineure, section « Nouveautés » |
| `fix` | `fix(docker): plus de crash à l'arrêt` | correctif, section « Corrections » |
| `perf`, `refactor`, `docs`, `build`, `security` | `perf(git): cache du tableau de bord` | correctif, section dédiée |
| `test`, `ci`, `chore`, `style` | `test: cas du cron` | correctif, non listé |
| `!` ou `BREAKING CHANGE:` | `feat!: nouveau format de stockage` | version majeure |

### Publier une version

```bash
npm run release -- --dry-run      # voir la version calculée et les notes, sans rien changer
npm run release -- --push         # vérifie, met à jour CHANGELOG.md + package.json, tague et pousse
npm run release -- --build --push # idem + installeur local dans dist/
npm run release -- minor          # forcer le type de version (major | minor | patch | 1.4.0)
npm run release -- --pre beta     # préversion : 1.3.0-beta.1, puis -beta.2…
```

Le tag `vX.Y.Z` poussé lance le workflow GitHub **Release** : il revérifie tout, construit l'installeur et publie la release avec ses notes (tirées de `CHANGELOG.md`). Une préversion est publiée comme « pre-release ».

Dans l'app, **Paramètres → À propos** affiche la version, le canal (stable / préversion), le commit et la date de build, ainsi que les notes de version. Après une mise à jour, un message propose de voir les nouveautés.
