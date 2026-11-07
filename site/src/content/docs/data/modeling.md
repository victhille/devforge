---
title: Modélisation
description: Concevoir sa base et son appli avant de coder — MCD (Merise), MLD, MPD et SQL liés à la vraie base, et diagrammes UML, logigrammes et architecture, enregistrés dans le projet.
---

La page **Modélisation** (menu *Données & API*) sert à concevoir avant de coder. Les modèles sont rangés **par projet** : ce sont des fichiers du dossier `conception/` du projet (`boutique.mcd.json`…), donc versionnés avec Git comme le reste du code.

## La page

- **Le sélecteur de projet**, en haut à droite : le projet actif par défaut.
- **La chaîne du projet** : MCD → MLD → MPD → SQL → base liée, avec l'état de chacun (*À jour*, *▲ À mettre à jour*, *Pas encore écrit*). Un clic ouvre l'étape. La base liée dit combien de différences la séparent du MPD.
- **Les modèles du projet** : un aperçu, le type, la date, le fichier. Un clic ouvre le modèle ; renommer et supprimer au survol. Renommer un MCD renomme aussi son MPD et son script.
- **Créer un modèle** : un **MCD**, un **MPD** (sa fenêtre demande une connexion : **Aucune** pour un MPD vierge, dessiné table par table, ou une base à lire, voir plus bas), ou un **diagramme** (cas d'utilisation, classes, séquence, logigramme, architecture) ; le MPD d'un MCD se génère depuis lui.

En haut de l'éditeur, les onglets **MCD · MLD · MPD · SQL** passent d'une étape à l'autre du même modèle. À gauche, le fil d'Ariane dit où tu es : **Projet › Modélisation › le modèle** quand tu l'as ouvert depuis l'onglet Modélisation d'un projet (un clic sur le projet y ramène), sinon **Modélisation › le modèle**. La flèche revient au premier.

## L'éditeur MCD

Un MCD décrit les données à la manière de Merise : des **entités** (CLIENT, COMMANDE…) avec leurs attributs, des **associations** entre elles (PASSER, CONTENIR…) et la **cardinalité** de chaque entité dans chaque association.

| Action | Comment |
|---|---|
| Ajouter une entité | glisser **Entité** de la barre du bas sur le canevas (ou un clic dessus), ou double-clic sur le fond |
| Ajouter une association | glisser **Association** de la barre du bas (ou un clic dessus) |
| Relier | survoler un élément : quatre points apparaissent ; tirer un point jusqu'à un autre élément. Entité → association : une patte ; entité → entité : une association entre elles, avec ses deux pattes ; lâché dans le vide : une nouvelle entité reliée là (Échap annule) |
| Changer une cardinalité | un clic dessus : 0,1 → 1,1 → 0,n → 1,n |
| Choisir plusieurs éléments | curseur **Sélection** (V) : glisser sur le fond trace une zone, tout ce qu'elle touche est choisi ; **Maj+clic** ajoute ou retire un élément ; **Ctrl+A** choisit tout ; **Échap** vide la sélection ; un clic (sans glisser) sur l'un des éléments choisis ne garde que lui |
| Déplacer | glisser un élément ; glisser l'un des éléments choisis les déplace ensemble |
| Déplacer la vue | curseur **Main** (H), ou **Espace** maintenu, ou la molette enfoncée : glisser le fond |
| Zoomer | la molette, ou − / + ; **Ajuster** montre tout |
| Supprimer | **Suppr** sur l'élément choisi, ou sur toute la sélection |
| Copier, coller, dupliquer | **Ctrl+C** puis **Ctrl+V** : la copie se pose un pas à côté (au milieu de l'écran quand l'original n'y est pas), aussi dans un autre MCD ; **Ctrl+X** coupe ; **Ctrl+D** ou **Dupliquer** duplique. Les pattes entre les éléments copiés suivent, un nom déjà pris est numéroté (CLIENT_2) |
| Aligner, répartir | plusieurs éléments choisis : le panneau de droite les aligne (à gauche, au centre, à droite, en haut, au milieu, en bas) ou les répartit à espaces égaux (trois au moins) |
| Annuler, rétablir | **Ctrl+Z**, **Ctrl+Y** |

Le panneau de droite modifie l'élément choisi : le nom, les **attributs** (nom, type, longueur d'un texte court) et ceux qui forment l'**identifiant** (soulignés). Une association peut porter des attributs (une quantité, une date…).

Chaque changement est **enregistré tout seul** dans le fichier du projet.

Une association tirée entre deux entités se pose à la place libre la plus proche de leur milieu : jamais sur une entité ni sur une autre association.

### Vérifier

**Vérifier** liste ce qui bloquerait la suite (le MLD) ou mérite un coup d'œil : une entité sans identifiant, un élément sans nom, deux éléments du même nom, un attribut sans type, une association reliée à moins de deux entités, une entité reliée à rien, deux éléments qui se chevauchent. Un clic sur une ligne choisit l'élément.

**Proposer un MCD propre**, sous la liste, montre ce que deviendrait le MCD, sans rien changer encore :

- chaque élément replacé là où rien ne le cache : les entités en colonnes, chaque association à la place libre la plus proche de ses entités, celles reliées à rien en ligne en dessous ;
- un nom par élément : deux associations du même nom prennent le rôle de leur clé étrangère quand le MPD le connaît (`requester_id` → ACCESS_REQUEST_REQUESTER), sinon un numéro ;
- une entité reliée à rien dont un attribut est la clé d'une autre (`user_id` → USER) lui est reliée, et reçoit son propre identifiant ;
- les tables qu'un framework crée pour lui (`doctrine_migration_versions`, `migrations`…) sont retirées.

Les onglets **Proposé** et **Actuel** comparent les deux, avec la liste des changements et le nombre de points à vérifier avant et après. L'aperçu se manipule comme l'éditeur : la molette zoome, un glisser le déplace, **−**, **+** et **Ajuster** en bas à droite. **Garder la version actuelle** ne change rien ; **Prendre la nouvelle version** la met dans l'éditeur, et **Ctrl+Z** revient en arrière.

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

**Table**, dans la barre du bas, ajoute une table avec sa clé `id` (un clic la pose au milieu, un glisser là où on la lâche) : un MPD peut se dessiner entièrement à la main, sans MCD ni base. **Suppr** retire la table choisie (ou la sélection) et les clés étrangères qui la visaient. Copier, coller, dupliquer, aligner et répartir marchent comme dans le MCD ; une clé étrangère vers une table copiée avec elle désigne la copie.

**Déduire le MCD** (dans le bandeau d'un MPD sans MCD lié) écrit le MCD de ces tables à côté du MPD, puis l'ouvre : une table de liaison (clé faite de clés étrangères) devient une association, une autre clé étrangère une association 1,1 (0,1 si elle peut être vide) — 0,n. Le MPD est alors lié à ce MCD, ses tables gardant leur place, leurs index et leurs colonnes uniques.

Un clic sur une table la retouche à droite : son nom, chaque colonne (nom, type, longueur, décimales, *Clé primaire*, *Vide*, *Unique*), ses **index** ; **Colonne** en ajoute une, la corbeille d'une colonne la retire, **Supprimer la table** en bas. Une colonne retouchée est marquée ✎ ; ↺ la ramène à ce que donne le MCD. Une clé étrangère prend le type de la clé qu'elle désigne. Pour en ajouter une, tirer un point d'une table (à gauche ou à droite) jusqu'à la table visée : la colonne (`categorie_id`…) s'ajoute, gardée quand le MPD est mis à jour.

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

**Créer un modèle → Modèle physique**, puis une connexion dans la liste, lit cette base et crée deux fichiers : son **MPD** (lié à la connexion) et le **MCD** qui s'en déduit :

- une table dont la clé est faite de clés étrangères vers deux tables ou plus redevient une **association**, ses autres colonnes ses attributs ;
- toute autre clé étrangère devient une association entre ses deux tables, **1,1** (ou **0,1** si elle peut être vide) côté table qui la porte, **0,n** de l'autre ; elle porte le nom du rôle de la clé quand il en dit un (`reviewer_id` → ACCESS_REQUEST_REVIEWER) ;
- les tables d'un framework (`doctrine_migration_versions`, `migrations`, `_prisma_migrations`…) sont laissées de côté, et jamais proposées à la suppression ;
- une clé primaire `id` devient l'identifiant `id_<table>` ; le nommage du MPD est deviné (`client_id` ou `id_client`, `snake_case`…).

Le MPD importé est la base telle quelle : aucune différence au départ.

Pendant l'import, une barre de progression montre chaque étape : connexion à la base, tables lues, MCD déduit, MPD, écriture dans `conception/`. Si une étape échoue, rien n'est laissé à moitié dans le dossier.

## Dans la page d'un projet

L'onglet **Modélisation** de la [page d'un projet](/devforge/dev/projects/) montre ses modèles, avec les mêmes miniatures que la page Modélisation :

- **Nouveau modèle** : un MCD ou un diagramme, créé à la main ;
- **Créer depuis la base** : visible quand une base est liée au projet (onglet Base de données). Un clic crée le MCD et le MPD lié, avec la barre de progression ; **Ouvrir le MCD** ou **Ouvrir le MPD** y mène ensuite. Avec plusieurs bases liées, une liste choisit laquelle ;
- **Demander à Forgy** : décris ton application, puis **Envoyer à Forgy**. Forgy propose un MCD (entités, attributs, associations, cardinalités) sur une carte, et ne l'écrit qu'après ton clic ; **Forgy, depuis la base** lui demande de partir de la base du projet. Voir [ses actions](/devforge/forgy/actions/).

## Les diagrammes

Cinq autres sortes de modèles se dessinent sur le même canevas, chacune avec ses éléments dans la barre du bas :

| Diagramme | Éléments | Liens |
|---|---|---|
| **Cas d'utilisation** | acteur, cas, système | association, «include», «extend», généralisation |
| **Classes** | classe, interface, énumération | association, héritage, implémentation, composition, agrégation, dépendance |
| **Séquence** | acteur, participant | message, retour |
| **Logigramme** | début, étape, décision, entrée / sortie, fin | flèche (libellée *oui*, *non*…) |
| **Architecture** | client, passerelle, service, base, file, externe | lien (libellé *HTTPS*, *SQL*…) |

Un élément de la barre du bas se glisse sur le canevas, là où on le lâche (un clic le pose au milieu de l'écran). Un lien se tire depuis un des points qui apparaissent au survol d'un élément, jusqu'à un autre ; il prend le **type des nouveaux liens** choisi dans la palette. Lâché dans le vide, il crée là un élément relié (une étape après une étape, un cas après un acteur, un service…). Dans une séquence, le message se pose sur la ligne de vie visée, à la hauteur où on le lâche. Un lien se choisit par sa pastille : le panneau change son type, son libellé, son sens. Une **note** s'ajoute partout. La sélection par zone, copier, coller, dupliquer, aligner et répartir marchent comme dans le MCD (dans une séquence, les participants restent sur leur ligne).

- **Classes** : le panneau prend les attributs et les méthodes, un par ligne (`- id : int`, `+ total() : float`) ; une énumération, ses valeurs.
- **Séquence** : les participants se rangent côte à côte, chaque message se place sous le précédent ; glisser sa pastille vers le haut ou le bas change son ordre.
- **Cas d'utilisation** : un système contient des cas (le déplacer les emmène, son coin le redimensionne) ; le panneau d'un cas dit son acteur, ce qu'il inclut, ce qui l'étend, et tient son **scénario**, une étape par ligne.

Comme le MCD : enregistrement au fil des changements dans `conception/` (`parcours-client.usecase.json`…), annuler / rétablir, zoom, Ajuster, export PNG et SVG ; un aperçu dans la liste des modèles.

### Créer les tâches dans Notes

Dans un diagramme de cas d'utilisation, **Créer les tâches dans Notes** ajoute une tâche par cas dans l'onglet [Notes](/devforge/dev/projects/) du projet (*Cas « Passer une commande » (Client)*). Une tâche déjà là n'est pas ajoutée deux fois.
