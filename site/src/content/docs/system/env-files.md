---
title: Variables .env
description: Comparer, compléter, modifier et sauvegarder (chiffrés) les fichiers .env de tes projets.
---

La page **Variables .env** réunit les fichiers `.env` de tous tes projets.

## Lire

![Les variables d'un projet, valeurs masquées](../../../assets/screens/env-files-fr.png)

À gauche, les projets qui ont des fichiers `.env`, `.env.local`, `.env.example`… À droite, une grille : une ligne par **clé**, une colonne par fichier. Une clé peut être *manquante* ou *vide* dans un fichier ; le fichier d'exemple est marqué *modèle*.

Les valeurs sont masquées par défaut : **Afficher les valeurs** / **Masquer les valeurs**.

## Compléter depuis le modèle

Si des clés du modèle (`.env.example`) manquent dans `.env`, un bandeau les liste. **Les ajouter depuis le modèle** les copie dans `.env`.

## Modifier

**Modifier** une valeur ou **Ajouter** une clé écrit directement dans le fichier.

**Régénérer** apparaît au survol des secrets que l'application tire elle-même, reconnus à leur nom exact : `APP_KEY`, `APP_SECRET`, `SECRET_KEY`, `SESSION_SECRET`, `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `BETTER_AUTH_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET`. Après confirmation, DevForge fait une **sauvegarde chiffrée** des fichiers `.env`, puis écrit un nouveau secret tiré au hasard : 32 octets en hexadécimal, ou `base64:` suivi de 32 octets pour l'`APP_KEY` de Laravel. Les sessions ouvertes et ce qui a été chiffré avec l'ancienne valeur ne sont plus lisibles ; **Restaurer** reprend la sauvegarde. Les secrets donnés par un service (`STRIPE_KEY`, `GITHUB_CLIENT_SECRET`, un token d'API) et les clés de chiffrement ne sont jamais proposés.

## Sauvegarder

- **Sauvegarde chiffrée** enregistre les `.env` du projet dans DevForge, chiffrés par Windows. La date de la dernière sauvegarde s'affiche.
- **Restaurer** écrase les fichiers `.env` avec la dernière sauvegarde, après confirmation.

Une sauvegarde est aussi faite avant chaque [récupération du .env d'un serveur](/devforge/dev/projects/#synchroniser-le-env-avec-le-serveur).

:::note[Forgy et les .env]
Forgy ne lit jamais les fichiers `.env` (sauf les fichiers d'exemple). Il peut seulement proposer d'**ajouter une nouvelle clé**, valeur masquée sur la carte, jamais de modifier une clé existante.
:::
