---
title: Sans ou avec DevForge
description: Ce que DevForge regroupe dans une fenêtre, ce qu'il ne remplace pas, et ses limites, pour décider en connaissance de cause.
---

Ce que DevForge regroupe, ce qu'il ne remplace pas, et ses limites. Pour décider en connaissance de cause.

## Ce qu'il regroupe

| Tâche | Sans DevForge | Avec DevForge |
|---|---|---|
| Lancer un projet et ses services | un terminal par projet, les commandes de mémoire | [Lanceur de stack](/devforge/dev/stacks/) |
| Voir l'état Git de tous ses projets | un `git status` dans chaque dossier | [Git](/devforge/dev/git/) |
| Lire et interroger une base | un client SQL | [Base de données](/devforge/data/database/) |
| Tester une API | un client HTTP | [API Tester](/devforge/data/api-tester/) |
| Recevoir un webhook en local | un service en ligne qui les capte | [Webhooks](/devforge/data/webhooks/) |
| Gérer conteneurs et projets Compose | l'interface de Docker, ou la ligne de commande | [Docker](/devforge/dev/docker/) |
| Aller sur le serveur | un client SSH, un bloc-notes de commandes | [SSH et tableau de bord](/devforge/servers/ssh/) |
| Savoir si le serveur va bien | se connecter et lancer `df`, `apt`, `systemctl`… | [Santé du serveur](/devforge/servers/health/) |
| Déployer | se connecter, `git pull`, build, redémarrer | [Déploiement](/devforge/online/deploy/) |
| Trouver qui occupe le port 3000 | `netstat`, puis le Gestionnaire des tâches | [Ports](/devforge/system/ports/) |
| Retrouver une clé dans les `.env` | ouvrir les fichiers un par un | [Variables .env](/devforge/system/env-files/) |
| Libérer de la place | chercher les `node_modules` oubliés | [Nettoyage disque](/devforge/system/cleaner/) |

Et [Forgy](/devforge/forgy/assistant/) par-dessus : un assistant qui connaît le projet ouvert, lit le code, les logs et la structure des bases, et propose des actions que tu valides.

## Ce qu'il ne remplace pas

- **Ton éditeur de code.** DevForge ouvre le projet dans ton IDE (VS Code, PhpStorm ou WebStorm) ; il n'édite pas le code lui-même.
- **Git, Node, Docker, PHP…** DevForge se sert de ceux installés sur ton PC. La page [Environnement](/devforge/system/environment/) dit ce qui manque.
- **Ton hébergeur.** DevForge déploie sur ton serveur ou sur Vercel ; il n'héberge rien.
- **Un vrai terminal, quand il le faut.** Il y en a un dans chaque fiche projet et sur chaque serveur.

## Ses limites

- **Windows 10 et 11 seulement**, pour l'instant.
- **Bases** : PostgreSQL, MySQL / MariaDB et SQLite.
- **Serveurs** : Linux, en SSH.
- **Forgy** demande une clé API Anthropic, payée à l'usage ; un budget mensuel l'arrête une fois atteint. Le reste de DevForge marche sans.

## Pour essayer

DevForge est gratuit et open source. [Télécharge-le](/devforge/download/), puis suis la [prise en main](/devforge/getting-started/installation/) ou un [guide](/devforge/guides/forgy-commit/).
