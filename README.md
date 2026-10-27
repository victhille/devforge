# DevForge

[English](README.en.md) · Français

Application de bureau Windows (Electron + React) qui regroupe les outils de dev du quotidien en un seul endroit : projets, Git, Docker / Compose, SSH et serveurs, bases de données, déploiements, surveillance, `.env`, domaines locaux, boîte à outils, et Forgy, un assistant IA.

DevForge ne contient rien de personnel : au premier lancement, tu choisis ta langue, ton dossier de projets et tu branches tes propres comptes (GitHub, serveurs, Vercel, bases, clé Anthropic). Tout reste sur ton PC, les secrets chiffrés par Windows.

## Ce qu'il fait

- **Projets** : création guidée (Laravel, Symfony, Next.js, Node…), ouverture dans l'éditeur, terminal intégré, scripts, ateliers par framework.
- **Git et GitHub** : état, branches, commits, pull requests.
- **Docker** : conteneurs, Compose, base de données Docker par projet, Docker d'un serveur par SSH.
- **Serveurs** : connexions SSH, santé, services, sauvegardes, VPN, n8n, page de statut.
- **Bases de données** : connexions, requêtes, sauvegardes.
- **Déploiements** : Vercel et serveurs.
- **Forgy** (Ctrl+J) : assistant avec ta propre clé Anthropic, outils en lecture seule, coût maîtrisé. Voir [docs/guide/forgy.md](docs/guide/forgy.md).

## Installer

Télécharge l'installeur `DevForge-Setup-vx.y.z.exe` dans les [releases](https://github.com/victhille/devforge/releases). DevForge se met ensuite à jour tout seul.

L'installeur n'est pas signé : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires » puis « Exécuter quand même ».

## Configurer

Tout se règle dans **Paramètres › Connexions** : GitHub (GitHub CLI ou jeton), identité Git, clé Forgy, Vercel, Docker, serveurs SSH, bases de données. Chaque service se teste et se retire au même endroit. **Paramètres › Données** exporte ta configuration (sans les secrets), la réimporte sur un autre PC, ou efface tout.

## Développer

Il faut Node.js 22 et Windows.

```bash
npm install
npm run dev        # app avec rechargement à chaud
npm run check      # types + lint + tests + build (comme la CI)
npm test           # tests seuls (Vitest) ; npm run test:watch en continu
npm run test:e2e   # tests de bout en bout (Playwright, sur l'app compilée)
npm run dist       # installeur Windows dans dist/
```

Pour un fork : change `repository` et `build.publish` dans `package.json`, les mises à jour et les liens « À propos » suivent.

Versions SemVer, commits conventionnels, `npm run release` pour publier : voir [docs/dev/versions.md](docs/dev/versions.md). Pour contribuer : [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE).
