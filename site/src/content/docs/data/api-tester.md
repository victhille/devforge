---
title: API Tester
description: Envoyer des requêtes HTTP et lire la réponse, avec en-têtes, corps, aperçu et historique.
---

L'**API Tester** envoie des requêtes HTTP et montre la réponse.

## La requête

- **Méthode** : GET, POST, PUT, PATCH ou DELETE.
- **URL** : par exemple `https://api.example.com/users`.
- **En-têtes** : paires clé / valeur, **Ajouter un en-tête**.
- **Corps** : par exemple du JSON `{ "clé": "valeur" }`.

**Envoyer** part.

## La réponse

En haut : **Statut**, **Temps** et **Taille**. Les onglets :

- **Aperçu** (pour une réponse HTML) : le rendu de la page, isolé et scripts désactivés ;
- **Brut** : le corps de la réponse ;
- **En-têtes** de la réponse.

## Historique

Les requêtes de la session sont listées dans **Historique** (méthode, chemin, statut) ; un clic remet la méthode et l'URL dans le formulaire.

## Avec Forgy

Sur cette page, Forgy reçoit la requête et la réponse (les en-têtes sensibles sont masqués). La tâche **Analyser la réponse API** explique un statut, une erreur ou un format. Les routes d'un projet Symfony, Next.js ou Laravel s'ouvrent ici depuis l'[atelier](/devforge/dev/projects/#les-ateliers-par-framework).
