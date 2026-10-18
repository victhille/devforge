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
| `docs` | `docs: guide des versions` | correctif | Documentation |
| `test`, `ci`, `chore`, `style` | `test: cas du cron` | correctif | non listé |
| `type!` ou `BREAKING CHANGE:` dans le corps | `feat!: nouveau stockage` | majeure | Changements majeurs |

La version suivante = le changement le plus important depuis le dernier tag.

## Sortir une version

```bash
npm run release -- --dry-run   # aperçu : version calculée + notes, rien n'est modifié
npm run release -- --push      # publie
```

`--push` enchaîne :

1. `npm run check` (types, lint, tests, build)
2. mise à jour de `package.json` et `CHANGELOG.md`
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
| CI | push sur `main`, pull request | types, lint, tests, build |
| Release | tag `v*` | vérifie tag = `package.json`, tests, installeur, release avec notes |

Fichiers publiés : `DevForge-Setup-vX.Y.Z.exe`, `.blockmap`, `latest.yml` (pour la future mise à jour automatique).
Une préversion est publiée comme *pre-release*.

## Dans l'application

- **Paramètres → À propos** : version, canal (Stable / Préversion), commit, date de build, notes de version.
- Après une mise à jour : notification avec lien vers les nouveautés.

## Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/release.mjs` | commande `npm run release` |
| `scripts/lib/release.mjs` | règles : lecture des commits, calcul de version, changelog |
| `scripts/release-notes.mjs` | notes d'une version (utilisé par la CI) |
| `CHANGELOG.md` | historique, généré — ne pas éditer les versions publiées |
| `.github/workflows/release.yml` | build et publication |
| `tests/scripts/release.test.ts` | tests des règles |
