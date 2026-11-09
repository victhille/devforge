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

`main` n'accepte que des pull requests, avec le check `check` de la CI réussi. Une version passe donc par une branche `release/X.Y.Z` et deux PR. Les deux se fusionnent par un **commit de fusion** (« Create a merge commit », jamais « Squash ») : `main` et `develop` gardent les mêmes commits, et le tag posé sur `main` arrive aussi dans `develop`.

```bash
npm run release -- prepare --dry-run   # aperçu depuis develop : version calculée et notes, rien n'est modifié
```

### 1. Branche `release/X.Y.Z`

Sur `develop` à jour, arbre propre (ou sur une branche `release/X.Y.Z` déjà coupée de `develop`) :

```bash
npm run release -- prepare --summary-fr "…" --summary-en "…"
```

Le script :

1. calcule la version depuis le dernier tag ;
2. lance `npm run check` (types, lint, tests, build) ;
3. crée la branche `release/X.Y.Z` ;
4. écrit `package.json`, `package-lock.json`, `CHANGELOG.md` et `CHANGELOG.en.md` (section de la version, avec le résumé) ;
5. régénère `THIRD_PARTY_LICENSES.md` (`npm run licenses`).

Il s'arrête là, sans commit. La section générée reprend le sujet des commits sans ligne `fr:` ou `en:` : du français jusque dans `CHANGELOG.en.md`. Le script dit combien. Réécris les deux sections pour les utilisateurs, une puce par zone (**Projets**, **SSH**…), comme pour la 0.1.0 et la 0.2.0. Puis, sur la branche :

```bash
npm run release -- prepare
```

Ce second passage vérifie que seuls les fichiers de la release ont changé et que chaque CHANGELOG a sa section. Il commite ensuite `chore(release): vX.Y.Z`, sans tag ni push. Avec `--commit`, le premier passage commite tout de suite, notes générées comprises.

### 2. PR vers `main`

```bash
git push -u origin release/X.Y.Z
```

Ouvre la PR `release/X.Y.Z` → `main`. La CI vérifie la branche ; une correction de dernière minute se commite sur la branche. Fusion par commit de fusion.

### 3. Tag sur `main`

```bash
git switch main
git pull
npm run release -- tag X.Y.Z
```

Sans numéro, le script prend celui de `package.json`. Avec le numéro, il signale clairement un `main` pas encore à la nouvelle version.

Le script vérifie que :

- la branche est `main`, à jour avec `origin/main` ;
- `package.json` est à la version ;
- le tag n'existe pas encore ;
- chaque CHANGELOG a la section de la version.

Il pose alors le tag annoté `vX.Y.Z`, avec la section du CHANGELOG pour message, et ne pousse que ce tag. Le workflow **Release** construit l'installeur et publie la release.

### 4. PR `main` → `develop`

Ouvre une PR de `main` vers `develop`, fusionnée elle aussi par commit de fusion. `develop` reçoit la version et le tag, et la release suivante part de là. Tant que ce n'est pas fait, `prepare` s'arrête sur « vX.Y.Z already exists ».

### Options

| Option | Mode | Effet |
|---|---|---|
| `minor` / `major` / `patch` | `prepare` | forcer le type de version |
| `1.4.0` | `prepare` | forcer le numéro |
| `--pre beta` | `prepare` | préversion : `1.3.0-beta.1`, puis `-beta.2`… |
| `--summary-fr "…"`, `--summary-en "…"` | `prepare` | résumé d'une ligne en tête de la section, affiché sur la carte de la release |
| `--commit` | `prepare` | commiter tout de suite, sans réécrire les notes |
| `--no-check` | `prepare` | sauter `npm run check` |
| `1.4.0` | `tag` | version attendue sur `main` (par défaut, celle de `package.json`) |
| `--dry-run` | les deux | aperçu, rien n'est modifié |

Une release sans `--pre` après une préversion la finalise : `1.3.0-beta.2` → `1.3.0`. Pour un installeur local : `npm run dist`.

## GitHub

| Workflow | Déclencheur | Rôle |
|---|---|---|
| CI | push sur `main` et `develop`, pull request | types, lint, mots personnels (`scripts/check-personal.mjs`, liste dans le secret `PERSONAL_PATTERNS`), tests unitaires, build, tests de bout en bout |
| Release | tag `v*` | vérifie tag = `package.json`, build, installeur, release avec notes (les tests ont déjà tourné avant le tag : `npm run check` et la CI) |

Fichiers publiés : `DevForge-Setup-vX.Y.Z.exe`, `.blockmap`, `latest.yml` (lu par la mise à jour automatique).
Une préversion est publiée comme *pre-release*.

## Mise à jour automatique

- `electron-updater` lit les releases GitHub : au démarrage (après 15 s), puis toutes les 6 h. Téléchargement en arrière-plan, installation au redémarrage.
- **Redémarrer et mettre à jour** lance l'installeur sans le mode silencieux (`quitAndInstall(false, true)`) : il ne montre que sa page de progression, puis relance DevForge. `build/installer.nsh` garde le mode d'installation existant (pour soi ou pour tous) et saute la page finale sur une mise à jour ; une première installation garde toutes ses pages. Quitter l'app sans cliquer installe toujours en silence.
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
| `scripts/release.mjs` | commande `npm run release` (`prepare`, `tag`) |
| `scripts/lib/release.mjs` | règles : lecture des commits, calcul de version, changelog, branche de release, conditions du tag |
| `scripts/release-notes.mjs` | notes d'une version pour GitHub : FR, puis EN dépliable |
| `CHANGELOG.md`, `CHANGELOG.en.md` | historique FR / EN : section écrite par `prepare`, puis réécrite à la main avant le commit de release. Ne pas éditer les versions publiées |
| `.github/workflows/release.yml` | build et publication |
| `tests/scripts/release.test.ts` | tests des règles |
