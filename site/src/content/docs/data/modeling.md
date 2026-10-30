---
title: Modélisation
description: Concevoir sa base et son appli avant de coder — MCD (Merise), MLD, MPD et SQL liés à la vraie base, et diagrammes UML, logigrammes et architecture, enregistrés dans le projet.
---

La page **Modélisation** (menu *Données & API*) sert à concevoir avant de coder. Les modèles sont rangés **par projet** : ce sont des fichiers du dossier `conception/` du projet (`boutique.mcd.json`…), donc versionnés avec Git comme le reste du code.

## La page

- **Le sélecteur de projet**, en haut à droite : le projet actif par défaut.
- **La chaîne du projet** : MCD → MLD → MPD → SQL → base liée, avec l'état de chacun (*À jour*, *▲ À mettre à jour*, *Pas encore écrit*). Un clic ouvre l'étape. La base liée dit combien de différences la séparent du MPD.
- **Les modèles du projet** : un aperçu, le type, la date, le fichier. Un clic ouvre le modèle ; renommer et supprimer au survol. Renommer un MCD renomme aussi son MPD et son script.
- **Créer un modèle** : un **MCD**, **Depuis une base** (voir plus bas), ou un **diagramme** (cas d'utilisation, classes, séquence, logigramme, architecture) ; le MPD se génère depuis le MCD.

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

## La base liée

Sous le MPD, **Base liée** choisit une connexion de la page [Base de données](/devforge/data/database/) du même moteur ; quand le `.env` du projet décrit une base déjà enregistrée, DevForge propose **Lier à …**. Le lien est gardé dans le MPD.

DevForge lit alors la base et liste ce qui diffère : `+` ce qui manque dans la base (une table, une colonne, une clé étrangère), `−` ce qui n'est que dans la base (en rouge : le rattraper supprime des données), `~` ce qui diffère (un type, *vide* ou non, la clé primaire). Une table absente de la base est marquée sur le dessin. La chaîne de la page Modélisation montre aussi *▲ 3 différence(s)* ou *À jour*. **Relire la base** relit après un changement fait ailleurs.

### Voir le script

**Voir le script** montre ce qui amène la base au MPD : les `CREATE TABLE` d'abord, puis les colonnes ajoutées, les types et les *vide* changés, les clés étrangères, et en dernier, en rouge, les `DROP`. Ce qu'un moteur ne sait pas faire seul reste en commentaire (SQLite ne change pas un type ; une clé primaire différente est à reprendre à la main).

- **Sauvegarder d'abord** exporte en SQL (structure et lignes) chaque table qu'une suppression touche ;
- **Appliquer** est possible une fois la case *J'ai compris* cochée quand des données seraient perdues ; tout le script passe ou rien (PostgreSQL, SQLite) — MySQL valide chaque changement de structure tout de suite ;
- dans un **projet Symfony**, **Créer une migration Doctrine** écrit plutôt `migrations/VersionAAAAMMJJHHMMSS.php` avec ces instructions : versionnée, et jouée partout par `doctrine:migrations:migrate`.

### Prendre la base dans le MPD

L'autre sens : le MPD reprend les tables, colonnes, types et clés de la base. Ce qui correspond par le nom garde son lien avec le MCD et sa place ; ce que la base change est marqué comme retouché, donc gardé quand le MPD est mis à jour depuis le MCD.

## Importer depuis une base

**Créer un modèle → Depuis une base** lit une connexion et crée deux fichiers : son **MPD** (lié à la connexion) et le **MCD** qui s'en déduit :

- une table dont la clé est faite de clés étrangères vers deux tables ou plus redevient une **association**, ses autres colonnes ses attributs ;
- toute autre clé étrangère devient une association entre ses deux tables, **1,1** (ou **0,1** si elle peut être vide) côté table qui la porte, **0,n** de l'autre ;
- une clé primaire `id` devient l'identifiant `id_<table>` ; le nommage du MPD est deviné (`client_id` ou `id_client`, `snake_case`…).

Le MPD importé est la base telle quelle : aucune différence au départ.

## Les diagrammes

Cinq autres sortes de modèles se dessinent sur le même canevas, chacune avec sa palette :

| Diagramme | Éléments | Liens |
|---|---|---|
| **Cas d'utilisation** | acteur, cas, système | association, «include», «extend», généralisation |
| **Classes** | classe, interface, énumération | association, héritage, implémentation, composition, agrégation, dépendance |
| **Séquence** | acteur, participant | message, retour |
| **Logigramme** | début, étape, décision, entrée / sortie, fin | flèche (libellée *oui*, *non*…) |
| **Architecture** | client, passerelle, service, base, file, externe | lien (libellé *HTTPS*, *SQL*…) |

Un élément de la palette s'ajoute au milieu de l'écran ; un lien se trace en choisissant son type, puis l'élément de départ et celui d'arrivée (Échap pour arrêter). Un lien se choisit par sa pastille : le panneau change son type, son libellé, son sens. Une **note** s'ajoute partout.

- **Classes** : le panneau prend les attributs et les méthodes, un par ligne (`- id : int`, `+ total() : float`) ; une énumération, ses valeurs.
- **Séquence** : les participants se rangent côte à côte, chaque message se place sous le précédent ; glisser sa pastille vers le haut ou le bas change son ordre.
- **Cas d'utilisation** : un système contient des cas (le déplacer les emmène, son coin le redimensionne) ; le panneau d'un cas dit son acteur, ce qu'il inclut, ce qui l'étend, et tient son **scénario**, une étape par ligne.

Comme le MCD : enregistrement au fil des changements dans `conception/` (`parcours-client.usecase.json`…), annuler / rétablir, zoom, Ajuster, export PNG et SVG ; un aperçu dans la liste des modèles.

### Créer les tâches dans Notes

Dans un diagramme de cas d'utilisation, **Créer les tâches dans Notes** ajoute une tâche par cas dans l'onglet [Notes](/devforge/dev/projects/) du projet (*Cas « Passer une commande » (Client)*). Une tâche déjà là n'est pas ajoutée deux fois.
