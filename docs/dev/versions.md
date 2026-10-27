# Versions et releases

## Numéro de version

Format [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

| Partie | Quand |
|---|---|
| Majeur `2.0.0` | changement incompatible |
| Mineur `1.3.0` | nouvelle fonctionnalité |
| Correctif `1.2.1` | correction, amélioration interne |
| Préversion `1.3.0-beta.1` | version de test avant la finale |

## Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `type(zone): description`.

| Type | Exemple | Version | Section du changelog |
|---|---|---|---|
| `feat` | `feat(db): explorateur de tables` | mineure | Nouveautés |
| `fix` | `fix(docker): crash à l'arrêt` | correctif | Corrections |
| `security` | `security(ssh): vérifier la clé serveur` | correctif | Sécurité |
| `perf` | `perf(git): cache du tableau de bord` | correctif | Performances |
| `refactor` | `refactor: découpe du client BDD` | correctif | Améliorations internes |
| `build` | `build: Electron 45` | correctif | Dépendances et build |
| `docs`, `test`, `ci`, `chore`, `style` | `test: cas du cron` | correctif | non listé |
| `type!` ou `BREAKING CHANGE:` dans le corps | `feat!: nouveau stockage` | majeure | Changements majeurs |

La version suivante = le changement le plus important depuis le dernier tag.

### Texte des notes (FR / EN)

Les notes existent en français et en anglais, affichées selon la langue choisie dans l'application. Le texte se donne dans le corps du commit :

```
feat(db): table explorer

fr: Explorateur de tables façon phpMyAdmin
en: Table explorer like phpMyAdmin
```

Sans ligne `fr:` ou `en:`, le sujet du commit est utilisé dans cette langue.

## Sortir une version

```bash
npm run release -- --dry-run   # aperçu : version calculée + notes, rien n'est modifié
npm run release -- --push      # publie
```

`--push` enchaîne :

1. `npm run check` (types, lint, tests, build)
2. mise à jour de `package.json`, `CHANGELOG.md` (FR) et `CHANGELOG.en.md` (EN)
3. commit `chore(release): vX.Y.Z` + tag `vX.Y.Z`
4. push → le workflow GitHub **Release** construit l'installeur et publie la release

Conditions : arbre git propre, branche `main`.

### Options

| Option | Effet |
|---|---|
| `minor` / `major` / `patch` | forcer le type de version |
| `1.4.0` | forcer le numéro |
| `--pre beta` | préversion : `1.3.0-beta.1`, puis `-beta.2`… |
| `--build` | installeur local dans `dist/` |
| `--no-check` | sauter `npm run check` |

Une release sans `--pre` après une préversion la finalise : `1.3.0-beta.2` → `1.3.0`.

## GitHub

| Workflow | Déclencheur | Rôle |
|---|---|---|
| CI | push sur `main`, pull request | types, lint, mots personnels (`scripts/check-personal.mjs`, liste dans le secret `PERSONAL_PATTERNS`), tests unitaires, build, tests de bout en bout |
| Release | tag `v*` | vérifie tag = `package.json`, build, installeur, release avec notes (les tests ont déjà tourné avant le tag : `npm run check` et la CI) |

Fichiers publiés : `DevForge-Setup-vX.Y.Z.exe`, `.blockmap`, `latest.yml` (lu par la mise à jour automatique).
Une préversion est publiée comme *pre-release*.

## Mise à jour automatique

- `electron-updater` lit les releases GitHub : au démarrage (après 15 s), puis toutes les 6 h. Téléchargement en arrière-plan, installation au redémarrage.
- **Canal** dans Paramètres → Mises à jour : *Stable* (versions finales) ou *Bêta* (aussi les préversions `2.0.0-beta…`).
- **Source** : `build.publish` et `repository` de `package.json` (un fork change ces deux champs). Le dépôt est public : aucune connexion n'est nécessaire. Avec `private: true`, l'app utilise le jeton de GitHub CLI ou celui enregistré dans Connexions.

## Dans l'application

- **Paramètres → Mises à jour** : canal, vérification, notes de version dans la langue de l'application.
- **Paramètres → À propos** : version, commit, date de build, rapport de diagnostic.
- Après une mise à jour : notification avec lien vers les nouveautés.

## Données et diagnostic

- **Format des données** : `userData/storage.json` (`schemaVersion`). Au démarrage, les migrations en attente tournent une fois, après une copie des données dans `userData/backups/` (5 gardées). Une donnée écrite par une version plus récente n'est jamais modifiée. Voir `src/main/services/storage/migrations.ts`.
- **Écriture** : chaque fichier passe par un fichier temporaire puis un renommage (`writeJsonFile`). Un plantage pendant une écriture ne laisse pas de fichier coupé.
- **Journal local** : `userData/logs/devforge.log`, 1 Mo × 3 fichiers, avec les secrets masqués. *Copier le rapport* (Paramètres → À propos) donne la version, le système et les 200 dernières lignes. Rien n'est envoyé.

## Tests de bout en bout

`npm run build` puis `npm run test:e2e` (Playwright). Chaque test lance l'app compilée sur un profil vide (`tests/e2e/launch.ts`), hors écran. Avant la suite, `tests/e2e/warmup.ts` démarre l'app une fois (sur un runner neuf, les premiers démarrages sont lents). En CI : 2 tests à la fois, 90 s par test, un second essai.

## Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/release.mjs` | commande `npm run release` |
| `scripts/lib/release.mjs` | règles : lecture des commits, calcul de version, changelog |
| `scripts/release-notes.mjs` | notes d'une version pour GitHub : FR, puis EN dépliable |
| `CHANGELOG.md`, `CHANGELOG.en.md` | historique FR / EN, généré — ne pas éditer les versions publiées |
| `.github/workflows/release.yml` | build et publication |
| `tests/scripts/release.test.ts` | tests des règles |
