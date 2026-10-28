---
title: Actions de Forgy
description: Ce que Forgy peut faire pour toi, toujours après ton accord, avec les garde-fous et le journal des actions.
---

Forgy peut aussi **agir**. Chaque action s'affiche en **carte** dans le panneau : ce qui va se passer, puis **Valider** ou **Refuser**. **Rien ne s'exécute avant ton clic.** La carte dit aussi si l'action pourra être annulée.

## Les actions

| Action | Ce qu'elle fait | Annulable | Auto possible |
|---|---|---|---|
| Commit | commit des fichiers modifiés (ou d'une liste) | oui (`reset --soft`), tant que ce n'est pas poussé | oui |
| Pull | `pull --ff-only` | non | non |
| Push | push vers l'upstream, jamais forcé | non | non |
| Compose | `up`, `stop` ou `restart` d'un projet Compose | oui (`up` ↔ `stop`) | `up` / `stop` |
| Conteneur | `start`, `stop` ou `restart` d'un conteneur | oui (`start` ↔ `stop`) | non |
| SQL | une requête : lecture (50 lignes) ou écriture | non | lecture seule |
| Libérer un port | arrête le processus qui écoute sur un port | non | non |
| Script | lance un script du `package.json` en arrière-plan | oui (arrêt) | oui |
| Variable .env | ajoute une **nouvelle** clé à un `.env` (valeur masquée sur la carte) | oui (suppression) | oui |
| Workflow n8n | active ou désactive un workflow | oui (inverse) | oui |
| Exécution n8n | relance une exécution en échec | non | non |
| Redéployer (Vercel) | relance un build, par défaut celui en production | non | non |
| Mettre en production (Vercel) | met un déploiement en production (aperçu, ou retour en arrière) | oui (production précédente) | non |
| Client VPN | crée un client WireGuard ; la page VPN s'ouvre sur son QR code | non | non |
| Sauvegarde | lance tout de suite la sauvegarde de nuit du serveur | non | non |
| GitHub Actions | relance les jobs en échec d'un run | non | non |
| Tâche | ajoute une tâche aux [notes d'un projet](/devforge/dev/projects/#les-notes-et-les-tâches), la coche ou la décoche | oui (supprimée, ou état d'avant) | oui |
| Paquets | met à jour des [paquets](/devforge/dev/packages/) npm, pnpm, yarn, Composer, Python (pip dans l'environnement virtuel, Poetry, uv, Pipenv), Cargo, Go, Bundler ou pub, dans leur intervalle ou vers la dernière version (une majeure est signalée sur la carte) | oui : manifeste et verrouillage remis, puis réinstallation | non |

## Toujours demander, ou Auto

**Paramètres › Forgy › Actions de Forgy** :

- **Toujours demander** (par défaut) : chaque action attend ton clic.
- **Auto pour les actions sûres** : seules les actions de la colonne « Auto possible » (annulables ou en lecture) partent sans clic. Push, pull, écriture SQL, ports et mises à jour de paquets demandent toujours ton accord.

## Garde-fous

| Domaine | Règle |
|---|---|
| SQL | une seule requête ; `DROP`, `TRUNCATE`, `ALTER … DROP`, `GRANT` et accès aux fichiers refusés ; `DELETE` et `UPDATE` sans `WHERE` refusés |
| Git | jamais de push forcé ; un premier push (sans upstream) se fait depuis la page Git |
| `.env` | jamais de modification d'une clé existante |
| Ports | jamais un service Windows ni DevForge |
| Paquets | seulement des paquets déclarés dans le manifeste ; outil absent (Composer, environnement virtuel, poetry, cargo…), .NET, Java ou manifeste ambigu : refusé avant toute carte |
| Refus | Forgy est prévenu et ne relance pas l'action |
| Arrêt | arrêter la réponse vaut refus des actions en attente |

Une action proposée depuis le [widget de bureau](/devforge/forgy/desktop/) ouvre DevForge sur la carte.

## Le journal

Le bouton ☑ du panneau ouvre le **Journal des actions** : chaque action proposée (faite, refusée, échouée, annulée), avec **Annuler cette action** quand c'est possible. Les 200 dernières sont gardées. Chaque action faite ou échouée apparaît aussi dans le widget **Activité** de l'accueil.
