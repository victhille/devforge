---
title: Base de données
description: Un client PostgreSQL, MySQL / MariaDB et SQLite, avec détection des bases de tes projets et de tes serveurs, et tunnel SSH.
---

La page **Base de données** est un client pour **PostgreSQL**, **MySQL / MariaDB** et **SQLite**. Les mots de passe sont chiffrés par Windows.

## Ajouter une connexion

**+** ouvre le formulaire :

| Champ | Détail |
|---|---|
| Type | PostgreSQL, MySQL / MariaDB ou SQLite |
| Nom | facultatif, par défaut `base@hôte` |
| Hôte, port, utilisateur, mot de passe, base | pour PostgreSQL et MySQL |
| Fichier SQLite | pour SQLite |
| Se connecter via | **Connexion directe**, ou un serveur SSH : la connexion passe alors par un **tunnel SSH**, rien à ouvrir sur le serveur. L'hôte et le port sont ceux vus depuis le serveur (`127.0.0.1` pour un service local) |

**Tester la connexion** vérifie avant d'enregistrer.

## Détecter des bases

**Détecter des bases** cherche des bases à ajouter sans rien saisir :

- **Sur un serveur (SSH)** : les conteneurs Docker PostgreSQL / MySQL / MariaDB (identifiants lus dans leur configuration) et les services installés sur le serveur. Ces bases passent par un tunnel SSH.
- **Dans vos projets (.env)** : les bases décrites dans les fichiers `.env` de tes projets.

**Ajouter** enregistre une base trouvée. Le bouton *Bases de données du serveur* de la page [SSH](/devforge/servers/ssh/) ouvre directement cette détection.

## Explorer

![Une table SQLite dans l'onglet Parcourir](../../../assets/screens/database-fr.png)

Choisis une connexion : la liste des tables (filtrable) s'affiche. L'onglet **Base** résume le serveur, la base, le nombre de tables, de vues et de lignes (estimation), les index et clés étrangères.

Pour une table :

| Onglet | Contenu |
|---|---|
| Parcourir | les lignes, page par page, triables en cliquant sur une colonne |
| Structure | colonnes (type, null, défaut, clé, extra, commentaire) et index |
| Relations | clés étrangères vers d'autres tables, et tables qui pointent vers celle-ci |
| SQL | une requête sur cette table |
| Infos | lignes, taille (données et index), moteur, interclassement, encodage, définition (DDL) |

## Requêtes SQL

**Nouvelle requête** ouvre un éditeur SQL. <kbd>Ctrl</kbd> <kbd>Entrée</kbd> exécute. Les résultats sont limités à 1000 lignes ; une requête d'écriture affiche le nombre de lignes modifiées.

## Ailleurs

- Une base peut être liée à un projet : l'onglet **Base de données** de sa [fiche](/devforge/dev/projects/#la-base-de-données-du-projet) l'explore sur place. **Ouvrir en grand** mène ici, et **← Retour à** *nom du projet* y ramène.
- [Nouveau projet](/devforge/dev/new-project/) ajoute ici la base qu'il crée.
- Forgy lit la structure des tables (jamais les données) quand cette page est ouverte, écrit du SQL et peut exécuter une requête après ton accord, avec des garde-fous (voir [Actions](/devforge/forgy/actions/#garde-fous)).
