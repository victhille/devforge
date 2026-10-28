---
title: Paquets
description: "L'onglet Paquets de la fiche projet : versions en retard, vulnérabilités et mises à jour avec retour en arrière, pour npm, Composer, Python, Rust, Go, Ruby et Dart ; les versions de .NET et Java."
---

L'onglet **Paquets** de la [fiche projet](/devforge/dev/projects/) montre les dépendances du projet, ce qui est en retard ou vulnérable, et les met à jour quand tu le décides. Rien ne se met à jour tout seul.

Il apparaît quand le projet a un `package.json` (npm, pnpm, yarn), un `composer.json` (Symfony, Laravel, PHP), ou le fichier de dépendances d'un [autre langage](#les-autres-langages).

## Une carte par manifeste

Chaque `package.json` et chaque `composer.json` a sa carte, sous-dossiers compris jusqu'à 3 niveaux (`node_modules` et `vendor` exclus) : un projet Laravel en a deux, un dépôt à plusieurs paquets en a un par paquet. L'en-tête de la carte donne le manifeste, le nom déclaré, le gestionnaire et le nombre de paquets.

Le gestionnaire est reconnu par le fichier de verrouillage, à côté du manifeste ou plus haut dans le projet : `pnpm-lock.yaml` pour pnpm, `yarn.lock` pour yarn, `package-lock.json` pour npm ; sinon par le champ `packageManager` du `package.json`, et npm par défaut.

## La liste

| Colonne | Contenu |
|---|---|
| Paquet | son nom ; un clic ouvre sa page sur npmjs.com ou packagist.org |
| Demandée | l'intervalle déclaré (`^1.2.0`, `^7.0\|^8.0`…) |
| Installée | la version présente dans `node_modules` ou `vendor`, ou *non installé* |
| Dernière | la dernière version publiée : registre npm (ou celui du `.npmrc`), versions stables de Packagist |
| État | *à jour*, *correctif*, *mineure*, **majeure** ou *inconnue*, et la vulnérabilité s'il y en a une |

Les filtres **En retard** (par défaut), **Majeures** et **Tous** changent ce qui s'affiche. Les paquets `php`, `ext-*` et `lib-*` de Composer sont laissés de côté.

## Les vulnérabilités

**Vérifier les vulnérabilités** lance l'audit du gestionnaire : `npm audit`, `pnpm audit`, `yarn audit` (yarn 1) ou `composer audit`. Chaque paquet concerné porte sa gravité : faible, modérée, élevée, critique, ou *gravité non précisée* quand l'avis n'en donne pas.

*Audit indisponible* s'affiche sans fichier de verrouillage, quand les dépendances ne sont pas installées, ou avec yarn 2 et plus.

## Mettre à jour

- **Mettre à jour** sur une ligne : la version la plus récente **dans l'intervalle déclaré**.
- **Passer à** *version* : sort de l'intervalle pour la dernière version publiée, et réécrit le `package.json` ou le `composer.json`.
- Coche plusieurs lignes puis **Mettre à jour la sélection**.
- **Mettre à jour les compatibles** fait tous les correctifs et mineures en une fois, sans sortir des intervalles.

Une **version majeure** demande confirmation : elle peut casser le projet, lis les notes de version du paquet avant.

Le journal de la commande s'affiche en direct ; **Journal de la dernière mise à jour** le garde après coup.

| Gestionnaire | Commande lancée |
|---|---|
| npm | `npm update`, ou `npm install paquet@latest` hors de l'intervalle |
| pnpm | `pnpm update`, ou `pnpm add paquet@latest` |
| yarn 1 | `yarn upgrade`, ou `yarn add paquet@latest` |
| yarn 2 et plus | `yarn up -R`, ou `yarn up paquet@latest` |
| Composer | `composer update paquet --with-dependencies`, ou `composer require paquet:^version` |

Une dépendance de développement le reste.

:::note[Retour en arrière automatique]
Avant chaque mise à jour, le manifeste et le fichier de verrouillage sont sauvegardés dans le dossier de DevForge (`backups/packages/`). Si une commande échoue, ils sont remis comme avant. Lance une installation si `node_modules` ou `vendor` a changé entre-temps.
:::

## Les autres langages

Les dépendances de ces langages ont aussi leur carte, avec les mêmes colonnes et les mêmes filtres :

| Langage | Fichiers lus | Version installée lue dans | Dernière version |
|---|---|---|---|
| Python | `requirements*.txt`, `pyproject.toml` (PEP 621, Poetry), `Pipfile` | `poetry.lock`, `uv.lock`, `Pipfile.lock`, ou l'environnement virtuel (`.venv`, `venv`, `env`) | PyPI |
| Rust | `Cargo.toml` | `Cargo.lock` | crates.io |
| Go | `go.mod` (modules directs) | `go.mod` | proxy.golang.org |
| Ruby | `Gemfile` | `Gemfile.lock` | RubyGems |
| Dart, Flutter | `pubspec.yaml` | `pubspec.lock` | pub.dev |
| .NET | `*.csproj`, `*.fsproj`, `*.vbproj` | le fichier lui-même | NuGet |
| Java, Kotlin | `pom.xml`, `build.gradle(.kts)` | le fichier lui-même | Maven Central |

Elles ont les mêmes boutons que npm : **Mettre à jour**, **Passer à** *version*, la sélection, **Mettre à jour les compatibles** et **Vérifier les vulnérabilités**. « Dans l'intervalle » se lit avec la syntaxe de chaque langage : `>=4.2,<5` et `~=1.4` en Python, `1.2` (soit `^1.2`) en Rust, `~> 7.1` en Ruby.

| Gestionnaire | Dans l'intervalle | Au-delà | Vulnérabilités |
|---|---|---|---|
| pip | `python -m pip install -U` dans l'environnement virtuel | la ligne du fichier réécrite (`>=` *version*), puis la même commande | `pip-audit -r` |
| Poetry | `poetry update` | `poetry add nom@^version` | `pip-audit` sur l'environnement |
| uv | `uv lock --upgrade-package`, puis `uv sync` | `uv add "nom>=version"` | `pip-audit` sur l'environnement |
| Pipenv | `pipenv update` | `pipenv install "nom>=version"` | `pip-audit` sur l'environnement |
| Cargo | `cargo update -p` | `cargo add nom@version` | `cargo audit` |
| Go | `go get module@latest` (dans sa version majeure), puis `go mod tidy` | — | `govulncheck` |
| Bundler | `bundle update` | le `Gemfile` réécrit (`~> majeure.mineure`), puis `bundle update` | `bundle-audit` |
| pub | `dart pub upgrade` (`flutter` pour un projet Flutter) | `dart pub add nom:^version` | — |

- **Comme pour npm**, les fichiers sont sauvegardés avant (le fichier de dépendances et son lockfile) ; si une commande échoue, ils sont remis tels quels et le journal reste affiché.
- **Python** passe toujours par l'environnement virtuel du projet (`.venv`, `venv` ou `env`), jamais par le Python du système. Sans environnement virtuel, la carte le dit et donne la commande qui le crée (`python -m venv .venv`). Avec pip, un échec remet le fichier, mais l'environnement garde ce qui a été installé : le journal donne la commande qui remet les anciennes versions.
- **Un outil absent** (`poetry`, `uv`, `cargo`…) est signalé avec la commande qui l'installe, et la mise à jour reste bloquée. **Un outil d'audit absent** (`pip-audit`, `cargo-audit`, `govulncheck`, `bundle-audit`) aussi : rien n'est vérifié tant qu'il manque.
- **.NET et Java** comparent seulement : une ligne en haut de la carte donne la commande à lancer dans le terminal du projet (`dotnet list package --outdated`, `mvn versions:display-dependency-updates`, `./gradlew dependencyUpdates`), avec **Copier la commande**.

Un `requirements-dev.txt` (ou `-test`, `-lint`) et les groupes optionnels d'un `pyproject.toml` comptent comme dépendances *dev*. Un `pyproject.toml` qui ne déclare aucune dépendance (réglages d'outils seulement) n'a pas de carte.

## Composer

- **Laravel Sail** : les commandes passent dans le conteneur (`docker compose exec -u sail laravel.test composer …`), il faut que Sail soit lancé.
- **Composer absent** du PC (et pas de Sail) : un bandeau le dit, avec le lien vers [getcomposer.org](https://getcomposer.org/). La liste se lit, mais les mises à jour sont désactivées.

## Avec Forgy

Forgy lit les paquets du projet : « Qu'est-ce qui est en retard dans ce projet ? », « Y a-t-il des vulnérabilités ? ». Il peut proposer une mise à jour par une **carte** à valider : jamais automatique, même en mode **Auto pour les actions sûres**, et annulable depuis le journal des actions. Voir [Actions de Forgy](/devforge/forgy/actions/).
