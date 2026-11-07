---
title: Explorer une base SQLite
description: Guide pas à pas pour trouver la base d'un projet, parcourir ses tables, comprendre sa structure et l'interroger, seul ou avec Forgy.
---

Ton projet a une base SQLite et tu veux voir ce qu'elle contient, sans installer de client SQL.

**Il faut** : un projet avec un fichier SQLite (`.db`, `.sqlite`). Compter 5 minutes.

## 1. Ajoute la base

Page **Base de données**, **+** : type **SQLite**, puis choisis le fichier de la base. **Tester la connexion** vérifie qu'il s'ouvre.

Pour PostgreSQL ou MySQL, **Détecter des bases** trouve seul celles décrites dans les `.env` de tes projets ou installées sur tes serveurs.

## 2. Parcours une table

Choisis la connexion : la liste des tables s'affiche, filtrable. Clique sur une table : l'onglet **Parcourir** montre les lignes page par page. Un clic sur une colonne trie.

![Une table SQLite dans l'onglet Parcourir](../../../assets/screens/database-fr.png)

## 3. Comprends la structure

- **Structure** : les colonnes (type, null, défaut, clé) et les index.
- **Relations** : les clés étrangères vers d'autres tables, et les tables qui pointent vers celle-ci.
- L'onglet **Base** résume tout : nombre de tables, de vues et de lignes, index et clés étrangères.

## 4. Écris une requête

**Nouvelle requête** ouvre un éditeur SQL. <kbd>Ctrl</kbd> <kbd>Entrée</kbd> exécute :

```sql
SELECT statut, COUNT(*) AS nombre
FROM commandes
GROUP BY statut
ORDER BY nombre DESC;
```

Les résultats sont limités à 1000 lignes. Une requête d'écriture affiche le nombre de lignes modifiées.

## 5. Demande à Forgy

Avec la page ouverte, <kbd>Ctrl</kbd> <kbd>J</kbd> et pose ta question : « Quels clients ont passé plus de trois commandes ? ». Forgy lit la **structure** des tables, jamais leurs données, et écrit la requête. Il peut la lancer pour toi après ton accord, avec des garde-fous : pas de `DROP`, pas de `DELETE` ni d'`UPDATE` sans `WHERE`.

## Pour aller plus loin

- [Base de données](/devforge/data/database/) : PostgreSQL, MySQL, tunnel SSH.
- [Les actions de Forgy](/devforge/forgy/actions/#garde-fous) : tous les garde-fous.
