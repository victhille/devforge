# Statistiques (/admin)

Combien de personnes téléchargent DevForge et visitent le dépôt, sur une page du site réservée au propriétaire : `https://victhille.github.io/devforge/admin/`. Aucun lien n'y mène et les moteurs de recherche ne l'indexent pas.

## Qui peut voir quoi

Le site est statique (GitHub Pages) : la page elle-même est publique, elle ne contient aucun chiffre. Elle lit tout chez GitHub avec le jeton de la personne connectée :

| Donnée | Source | Lisible par |
|---|---|---|
| Téléchargements par version, vérifications de mise à jour | compteurs des fichiers des releases | tout le monde (GitHub les montre déjà) |
| Étoiles, forks, abonnés | le dépôt | tout le monde |
| Visites, visiteurs uniques, sites d'origine, pages vues (14 derniers jours) | trafic GitHub | seulement un compte avec un accès en écriture au dépôt |
| Historique au-delà de 14 jours | `stats.json` dans le dépôt **privé** `devforge-stats` | seulement le propriétaire |

La page refuse en plus tout autre compte que `victhille`, mais le vrai verrou est GitHub : un autre jeton ne peut lire ni le trafic ni le dépôt privé.

Rien n'est envoyé depuis les copies installées : la page Vie privée reste vraie.

Ce que mesurent les chiffres :

- **Téléchargements** : les installeurs (`.exe`), donc les nouvelles installations et les mises à jour qui reprennent le fichier entier.
- **Vérifications de mise à jour** : les lectures de `latest.yml`. Chaque lancement d'une copie installée en fait une tant que cette version est la plus récente. C'est la meilleure indication de l'usage réel, sans aucune télémétrie.
- **Visiteurs uniques** : le chiffre mis en avant. GitHub ne dit pas qui visite, donc les passages du propriétaire sont inclus, mais pour 1 au plus par jour (contre chaque page vue dans les vues).
- **Sites d'origine** : une visite venue d'un moteur de recherche ou d'un forum n'est jamais celle du propriétaire ; « github.com » regroupe les passages depuis GitHub, les siens compris.
- **Clones** : archivés mais pas affichés. Ce sont surtout les exécutions de GitHub Actions (chaque job clone le dépôt) et les `git pull` du propriétaire, pas des personnes.

## Mise en place (une fois)

1. **Créer le dépôt privé** `victhille/devforge-stats`, avec un README pour qu'il ne soit pas vide.
2. **Créer un jeton à grain fin** : GitHub → Settings → Developer settings → Fine-grained tokens.
   - Dépôts : `devforge` et `devforge-stats` seulement.
   - Permissions : *Administration* en lecture (le trafic), *Contents* en lecture et écriture (l'archive), *Metadata* en lecture.
3. **L'enregistrer comme secret** `STATS_TOKEN` du dépôt `devforge` : Settings → Secrets and variables → Actions.
4. **Lancer le workflow** « Stats » une première fois : onglet Actions → Stats → Run workflow. Il tourne ensuite chaque nuit à 3 h 17 (UTC).

Pour se connecter à `/admin`, un jeton en **lecture seule** suffit et vaut mieux : mêmes dépôts, *Administration*, *Contents* et *Metadata* en lecture. Il reste dans l'onglet du navigateur, ou dans le navigateur si « Rester connecté » est coché. Tous les sites `victhille.github.io` partagent ce stockage : c'est une raison de plus pour un jeton en lecture seule, limité à ces deux dépôts, avec une date d'expiration.

## Ce qui tourne

- `.github/workflows/stats.yml` : chaque nuit, `scripts/stats-archive.mjs` lit GitHub et ajoute la journée à `stats.json` dans `devforge-stats`. Le journal du workflow (public) n'affiche que le nombre de jours archivés.
- `site/public/admin/` : la page (`index.html`, `admin.js`, `admin.css`), copiée telle quelle par Astro. Sa politique de sécurité (CSP) n'autorise que ses propres fichiers et `api.github.com`.
- `site/public/admin/stats-core.js` : le calcul partagé par le workflow et la page (compteurs des releases, fusion des jours), testé par `tests/scripts/stats.test.ts`.

GitHub met en pause un workflow planifié après 60 jours sans activité sur le dépôt : un mail prévient, un clic sur « Enable workflow » le relance.
