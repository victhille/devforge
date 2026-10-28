---
title: Base de données
description: Un client PostgreSQL, MySQL / MariaDB et SQLite, avec détection des bases de tes projets et de tes serveurs, tunnel SSH, tables et lignes modifiables, import CSV et export.
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
| Parcourir | les lignes, page par page, triables en cliquant sur une colonne ; modifiables (voir plus bas), exportables, et un CSV s'y importe |
| Structure | colonnes (type, null, défaut, clé, extra, commentaire) et index ; ajouter, modifier ou supprimer une colonne, renommer ou supprimer la table (voir plus bas) |
| Relations | clés étrangères vers d'autres tables, et tables qui pointent vers celle-ci |
| SQL | une requête sur cette table |
| Infos | lignes, taille (données et index), moteur, interclassement, encodage, définition (DDL) |

## Créer et modifier des tables

- **Nouvelle table** (le **+** en haut de la liste des tables) : son nom et ses colonnes. Une colonne `id` auto-incrémentée est prête ; chaque colonne a un **type** (proposés selon la base, ou à taper : `VARCHAR(255)`, `NUMERIC(10, 2)`…), un **défaut**, et les cases **Requis**, **Clé primaire**, **Auto-incrément**.
- Dans **Structure** : **Ajouter une colonne**, le crayon d'une colonne pour la modifier (nom, type, défaut, requis), la corbeille pour la supprimer ; **Renommer la table** ; **Supprimer la table**, qui demande de retaper son nom.

Chaque fenêtre montre d'abord la **requête qui va partir** ; rien ne s'exécute avant **Appliquer**. En cas d'erreur de la base, son message reste affiché et rien d'autre ne part.

Un défaut est pris tel quel s'il s'agit d'un nombre, d'un mot-clé (`CURRENT_TIMESTAMP`, `NULL`, `TRUE`…), d'une fonction (`now()`) ou d'une chaîne déjà entre apostrophes ; sinon il est mis entre apostrophes.

**SQLite** ne sait que renommer une colonne : pour changer son type, son défaut ou « Requis », la fenêtre renvoie à l'onglet **SQL**.

## Modifier les lignes

Dans **Parcourir**, une table qui a une **clé primaire** se modifie sur place :

- **double-clic** (ou <kbd>Entrée</kbd>) sur une cellule pour la modifier ; **NULL** d'un clic à côté du champ ; <kbd>Échap</kbd> annule ;
- **Ajouter une ligne** : une ligne vide en haut ; une cellule laissée vide garde la valeur par défaut de la colonne (l'auto-incrément, par exemple) ;
- coche des lignes, puis **Supprimer** : elles sont barrées ; **Garder** les reprend.

Les changements en attente sont surlignés ; tant qu'il y en a, la page et le tri ne changent pas. **Appliquer (n modifications)** montre les requêtes `UPDATE`, `INSERT` et `DELETE`, puis les lance **en une transaction** : si l'une échoue, aucune n'est gardée et le message de la base reste affiché. **Annuler les modifications** les oublie.

Les valeurs partent en paramètres, jamais collées dans le SQL. Une table sans clé primaire, une vue et les résultats de l'onglet SQL restent en lecture ; les colonnes binaires ne se modifient pas ici.

## Importer et exporter

- **Exporter** (dans **Parcourir**) écrit **toute la table** dans un fichier, pas seulement la page affichée : **CSV**, **JSON**, **SQL** (des `INSERT`) ou **SQL avec CREATE TABLE**. Les lignes sont lues par paquets de 1 000, dans l'ordre de la clé primaire.
- Les résultats d'une requête s'enregistrent aussi, en CSV ou en JSON, avec le bouton à côté de **Copier**.
- **Importer un CSV** : choisis le fichier ; le séparateur (`,`, `;`, tabulation, `|`) et l'encodage (UTF-8, ou Windows-1252 comme les CSV d'Excel) sont reconnus. Chaque colonne du fichier va dans la colonne de la table du même nom (casse, espaces, `_` et `-` ignorés) ; sous chaque en-tête, tu la changes ou tu l'ignores. Les 10 premières lignes s'affichent ; **Une cellule vide devient NULL** est coché par défaut.
- L'import part **en une transaction** : si une ligne est refusée (colonne requise vide, doublon de clé…), aucune n'est gardée et la ligne fautive du fichier est donnée. 50 Mo au plus.

Les fichiers passent toujours par la fenêtre d'enregistrement ou d'ouverture de Windows.

## Requêtes SQL

**Nouvelle requête** ouvre un éditeur SQL. <kbd>Ctrl</kbd> <kbd>Entrée</kbd> exécute. Les résultats sont limités à 1000 lignes ; une requête d'écriture affiche le nombre de lignes modifiées. Au-dessus des résultats, **CSV** ou **JSON** choisit le format de la copie (le choix est gardé) : en JSON, un objet par ligne.

## Ailleurs

- Une base peut être liée à un projet : l'onglet **Base de données** de sa [fiche](/devforge/dev/projects/#la-base-de-données-du-projet) l'explore sur place. **Ouvrir en grand** mène ici, et **← Retour à** *nom du projet* y ramène.
- [Nouveau projet](/devforge/dev/new-project/) ajoute ici la base qu'il crée.
- Forgy lit la structure des tables (jamais les données) quand cette page est ouverte, écrit du SQL et peut exécuter une requête après ton accord, avec des garde-fous (voir [Actions](/devforge/forgy/actions/#garde-fous)).
