---
title: API Tester
description: Envoyer des requêtes HTTP et lire la réponse, avec en-têtes, corps, aperçu et historique.
---

L'**API Tester** envoie des requêtes HTTP et montre la réponse.

## La requête

- **Méthode** : GET, POST, PUT, PATCH ou DELETE.
- **URL** : par exemple `https://api.example.com/users`.
- **Paramètres** : la query de l'URL, une ligne par paramètre ; ce que tu changes ici s'écrit dans l'URL, et l'inverse. Décoche une ligne pour la retirer de l'URL sans la perdre.
- **En-têtes** : paires clé / valeur à cocher, **Ajouter un en-tête**.
- **Corps** : par exemple du JSON `{ "clé": "valeur" }` (pas pour un GET).
- **Auth** : un jeton **Bearer** ou un utilisateur et un mot de passe **Basic**, envoyés en en-tête `Authorization` (sauf si tu en as déjà coché un). Rien n'est gardé.

**Envoyer** part.

## La réponse

En haut : le statut, le temps et la taille. À droite :

- **JSON** (pour une réponse JSON) : le corps indenté ;
- **Brut** : le corps tel que reçu ;
- **En-têtes** de la réponse ;
- **Aperçu** (pour une réponse HTML) : le rendu de la page, isolé et scripts désactivés.

## Historique

Le panneau **Historique**, à gauche, liste les requêtes envoyées (méthode et chemin, statut en cas d'erreur), d'une session à l'autre : seules la méthode et l'URL sont gardées, jamais les en-têtes ni le corps. Un clic remet la méthode et l'URL dans le formulaire ; **+** repart d'une requête vide, **Vider l'historique** efface la liste.

## Avec Forgy

Sur cette page, Forgy reçoit la requête et la réponse (les en-têtes sensibles sont masqués). La tâche **Analyser la réponse API** explique un statut, une erreur ou un format. Les routes d'un projet Symfony, Next.js ou Laravel s'ouvrent ici depuis l'[atelier](/devforge/dev/projects/#les-ateliers-par-framework).
