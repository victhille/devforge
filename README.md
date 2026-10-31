<p align="center"><img src="site/src/assets/logo.svg" width="88" alt="" /></p>

<h1 align="center">DevForge</h1>

<p align="center"><strong>Tout ton atelier de dev Windows dans une seule app : projets, Git, Docker, serveurs, bases de données et déploiements.</strong><br />Gratuit, open source, sans compte. Tes secrets restent sur ton PC.</p>

<p align="center">
  <a href="https://victhille.github.io/devforge/download/"><strong>Télécharger pour Windows</strong></a> ·
  <a href="https://victhille.github.io/devforge/">Site et documentation</a> ·
  <a href="README.en.md">English</a>
</p>

<p align="center">

[![Version](https://img.shields.io/github/v/release/victhille/devforge?label=version)](https://github.com/victhille/devforge/releases/latest)
[![CI](https://github.com/victhille/devforge/actions/workflows/ci.yml/badge.svg)](https://github.com/victhille/devforge/actions/workflows/ci.yml)
[![Licence](https://img.shields.io/github/license/victhille/devforge)](LICENSE)
![Windows 10 · 11](https://img.shields.io/badge/Windows-10%20%C2%B7%2011-0078D4)

</p>

![L'accueil de DevForge](site/src/assets/screens/home-fr.png)

Application de bureau Windows (Electron + React) qui regroupe les outils de dev du quotidien en un seul endroit : projets, Git, Docker / Compose, SSH et serveurs, bases de données, déploiements, surveillance, `.env`, domaines locaux, boîte à outils, et Forgy, un assistant IA.

DevForge ne contient rien de personnel : au premier lancement, tu choisis ta langue, ton dossier de projets et tu branches tes propres comptes (GitHub, serveurs, Vercel, bases, clé Anthropic). Tout reste sur ton PC, les secrets chiffrés par Windows.

## Ce qu'il fait

- **Projets** : création guidée (Laravel, Symfony, Next.js, Node…), ouverture dans l'éditeur, terminal intégré, scripts, ateliers par framework.
- **Git et GitHub** : état, branches, commits, pull requests.
- **Docker** : conteneurs, Compose, base de données Docker par projet, Docker d'un serveur par SSH.
- **Serveurs** : connexions SSH, santé, services, sauvegardes, VPN, n8n, page de statut.
- **Bases de données** : connexions, requêtes, sauvegardes, modélisation (MCD, MPD, diagrammes) et testeur d'API.
- **Déploiements** : Vercel et serveurs.
- **Forgy** (Ctrl+J) : assistant avec ta propre clé Anthropic, outils en lecture seule, coût maîtrisé. Voir [docs/guide/forgy.md](docs/guide/forgy.md).

## Installer

Télécharge l'installeur `DevForge-Setup-vx.y.z.exe` depuis la [page Télécharger](https://victhille.github.io/devforge/download/) ou les [releases](https://github.com/victhille/devforge/releases). DevForge se met ensuite à jour tout seul. La [prise en main](https://victhille.github.io/devforge/getting-started/installation/) détaille l'installation et chaque page du logiciel.

L'installeur n'est pas encore signé : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires » puis « Exécuter quand même ». Son empreinte SHA-256 est donnée sur la page Télécharger et dans les notes de chaque version, pour [vérifier le fichier](https://victhille.github.io/devforge/download/#vérifier-linstalleur).

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

[GPL-3.0](LICENSE) depuis la v4.0 : tu peux lire, modifier et redistribuer DevForge, à condition que toute version modifiée reste libre, sous GPL-3.0, avec son code source. Les versions jusqu'à la 3.9 restent sous MIT.

Le nom « DevForge », le logo et Forgy ne sont pas sous cette licence : un fork prend un autre nom, voir [TRADEMARKS.md](TRADEMARKS.md). Les contributions passent par un [accord de contribution](CLA.md).
