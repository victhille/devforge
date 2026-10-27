---
title: Docker
description: Conteneurs, images et projets Compose, en local et sur ton serveur, avec les logs en direct.
---

La page **Docker** pilote le moteur Docker de ce PC (Docker Desktop) et celui de tes serveurs.

:::note
Il faut [Docker Desktop](https://www.docker.com/products/docker-desktop/) lancé. Sinon, la page indique « Docker n'est pas disponible » ; l'état se voit aussi dans [Connexions](/devforge/getting-started/connections/#docker).
:::

## Local

En haut : la version de Docker et le nombre de conteneurs en cours. Deux vues :

- **Compose** : chaque projet Compose avec ses services (image, ports, statut, CPU), son état (*en ligne*, *arrêté*, *Jamais lancé*) et le projet DevForge auquel il appartient. **Démarrer**, **Arrêter**, **Redémarrer**, et **Supprimer les conteneurs** (les volumes, donc les données des bases, sont conservés : le projet pourra être relancé).
- **Seuls** : les conteneurs indépendants, avec démarrer, arrêter, redémarrer et supprimer (les données hors volume sont alors perdues).

Une vue **Images** liste les images.

### Logs

**Logs** ouvre les logs d'un conteneur ou de tous les services d'un projet, **en direct**. **Demander à Forgy** lui transmet les logs pour diagnostiquer un conteneur qui plante.

### Nettoyer

**Nettoyer** supprime les conteneurs arrêtés (sauf ceux des projets Compose), les réseaux inutilisés, les images orphelines et le cache de build. Les volumes sont conservés.

## Sur un serveur

L'onglet **VPS** montre le Docker d'un serveur SSH : ses conteneurs et leurs logs, à travers la connexion SSH. Si Docker n'est pas accessible sur le serveur, la page affiche l'erreur.

## Ailleurs dans DevForge

- L'onglet **Docker** de chaque [fiche projet](/devforge/dev/projects/) montre son projet Compose.
- Le widget **Docker** de l'accueil démarre et arrête les projets Compose.
- [Nouveau projet](/devforge/dev/new-project/) peut créer une base PostgreSQL ou MySQL dans Docker.
- Forgy peut proposer de lancer, arrêter ou redémarrer un projet Compose ou un conteneur ([Actions](/devforge/forgy/actions/)).
