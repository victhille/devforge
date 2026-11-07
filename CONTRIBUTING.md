# Contribuer à DevForge

Merci de ton intérêt ! Issues et pull requests sont les bienvenues, en français ou en anglais.

## Signaler un problème

Ouvre une [issue](https://github.com/victhille/devforge/issues/new/choose) : le formulaire « Signaler un problème » demande ce que tu faisais, ce qui s'est passé, ce que tu attendais, et le rapport de diagnostic (Paramètres › À propos › Copier le rapport : version, système, dernières lignes du journal, clés et mots de passe masqués). Relis-le avant de le coller : il peut contenir des noms de serveurs ou de projets.

Une idée ? Le formulaire « Proposer une idée ». Jette d'abord un œil aux [issues ouvertes](https://github.com/victhille/devforge/issues) : elle y est peut-être déjà.

**Faille de sécurité** : jamais dans une issue publique. Voir [SECURITY.md](SECURITY.md).

## Proposer une modification

Pour un premier pas, les issues [« good first issue »](https://github.com/victhille/devforge/issues?q=is%3Aopen+label%3A%22good+first+issue%22) sont choisies pour ça : petites, bien délimitées, avec les fichiers à regarder.

1. Forke le dépôt et crée une branche depuis `develop` (voir [Branches](#branches)).
2. `npm install`, puis `npm run dev` pour lancer l'app.
3. Ajoute ou mets à jour les tests : Vitest dans `tests/main`, Playwright dans `tests/e2e`.
4. `npm run check` doit passer (types, lint, tests, build), et `npm run build` puis `npm run test:e2e` pour les tests de bout en bout.
5. Ouvre une pull request vers `develop` : son modèle rappelle ce qu'il faut vérifier.

La CI tourne sur ta pull request (Windows, environ 5 min ; pour une première contribution, un mainteneur la lance d'un clic). Une étape vérifie qu'aucun mot personnel de l'auteur ne revient : sa liste est un secret que GitHub ne donne pas aux forks, donc elle est sautée sur ta PR et repasse sur `main` après la fusion. Rien à faire de ton côté.

L'architecture du code est décrite dans [docs/dev/architecture.md](docs/dev/architecture.md).

## Branches

| Branche | Rôle | Part de | Revient dans |
|---|---|---|---|
| `main` | versions publiées, chaque commit porte un tag `vX.Y.Z` | — | — |
| `develop` | intégration de la prochaine version | `main` | `main` (via `release/*`) |
| `feat/<sujet>` | une fonctionnalité | `develop` | `develop` |
| `fix/<sujet>` | une correction | `develop` | `develop` |
| `chore/<sujet>`, `docs/<sujet>` | outillage, documentation | `develop` | `develop` |
| `release/X.Y.Z` | préparer une version (numéro, CHANGELOG) | `develop` | `main` puis `develop` |
| `hotfix/X.Y.Z` | correction urgente d'une version publiée | `main` | `main` puis `develop` |

- `main` et `develop` sont protégées : pas de push direct, la CI doit passer.
- Une branche de travail est fusionnée en *squash* dans `develop` (un commit propre par sujet) ; `release/*` et `hotfix/*` sont fusionnées dans `main` sans squash, puis taguées.
- Noms courts, en minuscules, avec des tirets : `feat/explorateur-tables`, `fix/ssh-timeout`.

## Conventions

- **Commits conventionnels** : `feat(zone): …`, `fix(zone): …`, `docs: …`, `test: …`, `ci: …`. Le CHANGELOG en est tiré, voir [docs/dev/versions.md](docs/dev/versions.md).
- **Textes de l'interface** : toujours dans `src/renderer/src/i18n/locales/fr.ts` et `en.ts`, jamais en dur.
- **Secrets** : jamais envoyés au renderer, jamais affichés, jamais écrits en clair (chiffrés avec `safeStorage`).
- **Rien de personnel** : pas d'IP, de nom de serveur ou de compte réels dans le code, les tests ou la doc. Pour les exemples : `203.0.113.10` (adresse de documentation), `mon-serveur`, `example.com`.

## Licence

En contribuant, tu acceptes l'[accord de contribution](CLA.md) (une case à cocher dans la pull request) : ta contribution est publiée sous la [licence GPL-3.0](LICENSE) du projet, et le mainteneur peut la réutiliser sous une autre licence. Tu restes l'auteur de ce que tu apportes.
