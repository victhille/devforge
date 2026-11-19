# Dépendances, poids et minuteurs

Les règles qui gardent DevForge léger et à jour.

## Versions des dépendances

Deux règles, selon ce que fait le paquet :

| Paquet | Écriture dans `package.json` | Pourquoi |
|---|---|---|
| Ce qui est livré et touche au système : `electron`, `electron-updater`, `node-pty`, `ssh2`, les pilotes de base (`mysql2`, `pg`, `sql.js`), `@huggingface/transformers`, `@anthropic-ai/sdk` | version exacte (`44.11.5`) | un module natif ou l'exécutable doit être celui qu'on a testé ; une mise à jour passe par une PR |
| L'outillage de build et de test, et les bibliothèques de l'interface | `^` (`^5.4.0`) | `package-lock.json` fixe déjà la version installée ; `^` laisse Dependabot proposer les mineures groupées |

`package-lock.json` fait foi dans les deux cas : la CI et la release installent avec `npm ci`. Les versions majeures se font toutes à la main (Dependabot les ignore). `THIRD_PARTY_LICENSES.md` est régénéré à chaque release par `npm run release -- prepare` : une PR de Dependabot n'a pas à le mettre à jour.

## `overrides`

```json
"overrides": {
  "minimatch@^9": "^11.0.1",
  "minimatch@^10": "^11.0.1"
}
```

L'avis [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (déni de service par amplification des motifs) touche minimatch de 7.0.0 à 11.0.0, sans correctif en 9.x ni en 10.x : les dépendances qui demandent ces deux branches reçoivent la 11. Les copies 3.x et 5.x d'electron-builder ne sont pas concernées par cet avis et sont au-dessus des correctifs des avis précédents (3.1.4, 5.1.8). À retirer quand plus aucune dépendance ne demande minimatch 9 ou 10 (`npm ls minimatch`).

## La dictée

`@huggingface/transformers` amène `onnxruntime-node` et `sharp`, sans qu'ils soient dans `package.json`. Leurs binaires macOS, Linux et ARM, et les DLL DirectML, sont retirés du paquet (`build.files`). La dictée tourne sur le processeur. `onnxruntime-web` arrive aussi, en version de développement : il n'est pas livré, mais une mise à jour de `transformers` doit être suivie d'un essai de la dictée.

## Poids

`scripts/size-budget.mjs` fait échouer la CI quand le JavaScript du premier écran dépasse son budget (1,6 Mo ; 1,2 Mo mesuré en novembre 2026). L'étape « Installer size » de `release.yml` arrête la release quand l'installeur dépasse 150 Mo (132 Mo mesuré). Le script vérifie aussi un installeur en local : `node scripts/size-budget.mjs --installer dist/DevForge-Setup-vX.Y.Z.exe`. Un budget se relève exprès, avec la raison dans le commit : celui du premier écran dans le script, celui de l'installeur dans le script et dans l'étape « Installer size » de `release.yml`.

Ce qui a été vérifié (novembre 2026) :
- toutes les pages sont chargées à la demande (`lazy`), comme le lecteur PDF (pdf.js, 2 Mo) et la coloration du code (`import()`), et les pages lourdes (fiche projet, modélisation) : rien de cela n'est dans le premier écran ;
- le premier écran (entrée et modules préchargés, environ 60 fichiers) est lu sur le disque, pas sur le réseau ;
- les journaux gardent 5 000 lignes au plus (page Logs), et 1 000 par processus lancé depuis une pile ;
- au démarrage, les réglages sont lus deux fois (la langue avant Chromium, puis le reste) : un petit JSON, quelques millisecondes.

## Minuteurs

Dans la fenêtre, les écrans qui interrogent le réseau s'arrêtent quand elle est cachée (`visibleInterval`, voir [architecture.md](architecture.md)). Le processus principal, lui, continue exprès : ses minuteurs servent les alertes, qui doivent arriver même quand DevForge est réduit dans la zone de notification.

| Minuteur | Fréquence | Fichier |
|---|---|---|
| Surveillance des serveurs | 60 s | `services/monitor/vpsWatch.ts` |
| Sites surveillés | celle de chaque site | `services/monitor/urlMonitor.ts` |
| Historique de la surveillance (écriture) | 5 min | `services/monitor/history.ts` |
| Alerte CI | 5 min | `services/github/ciWatch.ts` |
| Sauvegardes de la nuit | 30 min | `services/backups/backupsService.ts` |
| Mises à jour | 6 h | `services/updates/updater.ts` (app installée seulement) |

Sans rien à surveiller, un passage ne fait rien. Chacun a sa fonction `stop…`, appelée à la fermeture (`before-quit` dans `src/main/index.ts`).
