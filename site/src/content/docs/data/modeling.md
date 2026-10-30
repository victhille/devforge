---
title: Modélisation
description: Concevoir sa base et son appli avant de coder — un MCD (Merise) dessiné dans DevForge, son MLD, son MPD et le script SQL, enregistrés dans le projet et versionnés avec Git.
---

La page **Modélisation** (menu *Données & API*) sert à concevoir avant de coder. Les modèles sont rangés **par projet** : ce sont des fichiers du dossier `conception/` du projet (`boutique.mcd.json`…), donc versionnés avec Git comme le reste du code.

## La page

- **Le sélecteur de projet**, en haut à droite : le projet actif par défaut.
- **La chaîne du projet** : MCD → MLD → MPD → SQL → base liée, avec l'état de chacun (*À jour*, *▲ À mettre à jour*, *Pas encore écrit*). Un clic ouvre l'étape. La base liée arrive avec la prochaine version.
- **Les modèles du projet** : un aperçu, le type, la date, le fichier. Un clic ouvre le modèle ; renommer et supprimer au survol. Renommer un MCD renomme aussi son MPD et son script.
- **Créer un modèle** : un **MCD** pour l'instant ; le MPD se génère depuis le MCD (les diagrammes UML et l'import depuis une base suivent).

En haut de l'éditeur, les onglets **MCD · MLD · MPD · SQL** passent d'une étape à l'autre du même modèle.

## L'éditeur MCD

Un MCD décrit les données à la manière de Merise : des **entités** (CLIENT, COMMANDE…) avec leurs attributs, des **associations** entre elles (PASSER, CONTENIR…) et la **cardinalité** de chaque entité dans chaque association.

| Action | Comment |
|---|---|
| Ajouter une entité | **Entité** dans la palette, ou double-clic sur le fond |
| Ajouter une association | **Association** dans la palette |
| Relier | **Lien**, puis une entité et une association (Échap pour arrêter) |
| Changer une cardinalité | un clic dessus : 0,1 → 1,1 → 0,n → 1,n |
| Déplacer | glisser un élément ; glisser le fond déplace la vue |
| Zoomer | la molette, ou − / + ; **Ajuster** montre tout |
| Supprimer | **Suppr** sur l'élément choisi |
| Annuler, rétablir | **Ctrl+Z**, **Ctrl+Y** |

Le panneau de droite modifie l'élément choisi : le nom, les **attributs** (nom, type, longueur d'un texte court) et ceux qui forment l'**identifiant** (soulignés). Une association peut porter des attributs (une quantité, une date…).

Chaque changement est **enregistré tout seul** dans le fichier du projet.

### Vérifier

**Vérifier** liste ce qui bloquerait la suite (le MLD) ou mérite un coup d'œil : une entité sans identifiant, un élément sans nom, deux éléments du même nom, un attribut sans type, une association reliée à moins de deux entités, une entité reliée à rien. Un clic sur une ligne choisit l'élément.

### Exporter

**PNG** ou **SVG** enregistre le MCD en image.

## Le MLD

L'onglet **MLD** montre le schéma relationnel, recalculé à chaque changement du MCD : `COMMANDE (id_commande, passee_le, #id_client)`, la clé primaire soulignée, les clés étrangères après un `#`. **Copier le texte** le prend tel quel (la clé primaire entre `_`).

Sous le schéma, **les règles appliquées**, une par ligne :

| Cas | Ce qui se passe |
|---|---|
| Une entité | elle devient une relation ; son identifiant est la clé primaire (sans identifiant, un `id_…` est ajouté) |
| Une association avec un côté x,1 (`0,n — 1,1`) | la clé de l'autre entité descend dans celle-ci ; les attributs portés la suivent |
| x,1 des deux côtés (`0,1 — 1,1`) | la clé va du côté 1,1, unique |
| Plusieurs des deux côtés, ou plus de deux entités | l'association devient une relation, de clé ses clés étrangères |
| Une association reliée à moins de deux entités | laissée de côté |

À droite, **le nommage pour le MPD** : les tables en `snake_case`, `MAJUSCULES` ou `PascalCase` ; les clés primaires en `id` ou comme le MCD ; les clés étrangères en `client_id` ou `id_client` ; les tables d'association d'après leurs tables (`commande_produit`) ou d'après l'association (`contenir`).

**Générer le MPD** l'écrit à côté du MCD (`boutique.mpd.json`) et l'ouvre.

## Le MPD

Les tables du MLD avec leurs types pour le **moteur** choisi (PostgreSQL, MySQL ou SQLite), dessinées comme le [schéma d'une base](/devforge/data/database/) : les clés primaires 🔑, les clés étrangères en couleur avec leur flèche, `!` pour une colonne qui ne peut pas être vide. Le moteur de départ est celui du projet (son `.env`, son fichier compose), PostgreSQL sinon.

Un clic sur une table la retouche à droite : son nom, chaque colonne (nom, type, longueur, décimales, *Vide*, *Unique*) et ses **index**. Une colonne retouchée est marquée ✎ ; ↺ la ramène à ce que donne le MCD. Une clé étrangère prend le type de la clé qu'elle désigne.

Quand le MCD change, le MPD le signale : **Mettre à jour** refait les tables d'après le MCD en gardant les retouches, les index et la place de chaque table. **Réorganiser** replace les tables ; zoom, Ajuster, mini-carte, annuler / rétablir et l'export PNG / SVG marchent comme dans le MCD.

**Vérifier** liste ce que le moteur refuserait : une table sans clé primaire, deux tables ou deux colonnes du même nom, une clé étrangère d'un autre type que sa cible, un texte long unique sous MySQL.

## Le SQL

L'onglet **SQL** montre le script `CREATE TABLE` du MPD pour son moteur : les tables désignées d'abord, les clés primaires (numérotées par la base quand c'est un entier seul), les clés étrangères, les index ; un cycle de clés se termine par des `ALTER TABLE`. Un nom réservé (`user`, `order`…) est mis entre guillemets. Changer de moteur réécrit les types.

**Écrire boutique.sql** l'enregistre dans `conception/` à côté du modèle ; la page dit quand le fichier écrit est plus ancien que le MPD. **Copier** le prend pour le coller ailleurs.
