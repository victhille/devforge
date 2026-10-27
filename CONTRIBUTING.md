# Contribuer à DevForge

Merci de ton intérêt ! Issues et pull requests sont les bienvenues, en français ou en anglais.

## Signaler un problème

Ouvre une [issue](https://github.com/victhille/devforge/issues) avec : ce que tu faisais, ce qui s'est passé, ce que tu attendais, et le rapport de diagnostic (Paramètres › À propos › Copier le rapport : version, système, dernières lignes du journal, clés et mots de passe masqués). Relis-le avant de le coller : il peut contenir des noms de serveurs ou de projets.

**Faille de sécurité** : ne l'écris pas dans une issue publique. Utilise « Report a vulnerability » dans l'onglet Security du dépôt.

## Proposer une modification

1. Forke le dépôt et crée une branche depuis `main`.
2. `npm install`, puis `npm run dev` pour lancer l'app.
3. Ajoute ou mets à jour les tests : Vitest dans `tests/main`, Playwright dans `tests/e2e`.
4. `npm run check` doit passer (types, lint, tests, build) ; c'est ce que lance la CI.
5. Ouvre une pull request qui explique le pourquoi.

## Conventions

- **Commits conventionnels** : `feat(zone): …`, `fix(zone): …`, `docs: …`, `test: …`, `ci: …`. Le CHANGELOG en est tiré, voir [docs/dev/versions.md](docs/dev/versions.md).
- **Textes de l'interface** : toujours dans `src/renderer/src/i18n/locales/fr.ts` et `en.ts`, jamais en dur.
- **Secrets** : jamais envoyés au renderer, jamais affichés, jamais écrits en clair (chiffrés avec `safeStorage`).
- **Rien de personnel** : pas d'IP, de nom de serveur ou de compte réels dans le code, les tests ou la doc. Pour les exemples : `203.0.113.10` (adresse de documentation), `mon-serveur`, `example.com`.

## Licence

En contribuant, tu acceptes que ta contribution soit publiée sous la [licence MIT](LICENSE) du projet.
