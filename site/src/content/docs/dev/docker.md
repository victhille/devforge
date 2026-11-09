---
title: Docker
description: Conteneurs, images et projets Compose, en local et sur ton serveur, avec les logs en direct.
---

La page **Docker** pilote le moteur Docker de ce PC (Docker Desktop) et celui de tes serveurs.

:::note
Il faut [Docker Desktop](https://www.docker.com/products/docker-desktop/) lancé. Sinon, la page indique « Docker n'est pas disponible » ; l'état se voit aussi dans [Connexions](/devforge/getting-started/connections/#docker).
:::

## Ce PC

En haut : la version de Docker, le nombre de conteneurs en cours et d'images. L'onglet **Ce PC** montre le Docker de ce PC, et chaque serveur a son onglet (au-delà de trois serveurs, un onglet **VPS** et un sélecteur).

Le menu de gauche :

- **Compose** : chaque projet Compose, avec le nombre de services en ligne. À droite, ses services (image, ports, CPU, mémoire, état *en ligne* ou *arrêté*) et le projet DevForge auquel il appartient. **Démarrer**, **Redémarrer**, **Arrêter**, et **Supprimer les conteneurs** (les volumes, donc les données des bases, sont conservés : le projet pourra être relancé). Un projet jamais lancé l'indique.
- **Autres** › **Conteneurs seuls** : les conteneurs lancés sans projet Compose, avec démarrer, arrêter, redémarrer et supprimer (les données hors volume sont alors perdues).
- **Autres** › **Images** : les images, leur date et leur taille.

### Journaux

Sous les services, les **journaux** de tous les services d'un projet, **en direct** ; un clic sur un service n'affiche que les siens. **Demander à Forgy** lui transmet les journaux pour diagnostiquer un conteneur qui plante.

### Nettoyer

**Nettoyer** supprime les conteneurs arrêtés (sauf ceux des projets Compose), les réseaux inutilisés, les images orphelines et le cache de build. Les volumes sont conservés.

## Sur un serveur

L'onglet d'un serveur montre son Docker, à travers la connexion SSH : ses projets Compose et ses conteneurs, avec démarrer, arrêter et redémarrer ; un clic sur un conteneur affiche ses dernières lignes de journal. Si Docker n'est pas accessible sur le serveur, la page affiche l'erreur.

## Ailleurs dans DevForge

- L'onglet **Docker** de chaque [fiche projet](/devforge/dev/projects/) montre son projet Compose.
- Le widget **Docker** de l'accueil démarre et arrête les projets Compose.
- [Nouveau projet](/devforge/dev/new-project/) peut créer une base PostgreSQL ou MySQL dans Docker.
- Forgy peut proposer de lancer, arrêter ou redémarrer un projet Compose ou un conteneur ([Actions](/devforge/forgy/actions/)).
