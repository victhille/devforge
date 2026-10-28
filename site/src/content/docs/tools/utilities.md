---
title: Outils
description: Boîte à outils (JSON, Base64, JWT, regex, hash, UUID, cron, timestamp, URL), snippets, diff texte, générateur de secrets et aide-mémoire.
---

Le groupe **Outils** réunit les petits utilitaires du quotidien. Tout tourne sur ton PC, sans rien envoyer.

## Boîte à outils

Une page, un onglet par outil, et **Chercher un outil…** pour aller vite :

| Outil | Ce qu'il fait |
|---|---|
| JSON | **Formater** ou **Minifier**, avec une erreur claire si le JSON est invalide |
| Base64 | **Encoder** / **Décoder** |
| JWT | décode l'en-tête et le contenu (payload) d'un jeton, sans vérifier la signature |
| Regex | un motif et ses flags, testés sur un texte : les correspondances sont surlignées |
| Hash | SHA-1, SHA-256, SHA-384 ou SHA-512 d'un texte |
| UUID | génère plusieurs UUID v4 d'un coup |
| Cron | explique une expression cron (minute, heure, jour, mois, jour de la semaine) et donne les **prochaines exécutions** |
| Timestamp | convertit un timestamp Unix (secondes ou millisecondes) en heure locale et en relatif ; **Maintenant** |
| URL | encode (`encodeURIComponent` ou `encodeURI`), décode, et découpe une URL : protocole, hôte, chemin, paramètres, ancre |

Chaque sortie a son bouton **Copier**.

## Aide et exemples

En tête de chaque outil (les onglets de la boîte à outils, les Snippets, le Diff, le Générateur et les [Webhooks](/devforge/data/webhooks/)), un bandeau dit **à quoi il sert** et **comment s'en servir**, avec des **exemples** à charger d'un clic :

- **Regex** : des exemples grisés dans les champs, et des modèles qui remplissent le motif et le texte de test : *E-mail*, *Date jj/mm/aaaa*, *Lien http(s)*, *Téléphone français* ;
- **JSON**, **Base64**, **JWT**, **Hash**, **URL**, **Timestamp**, **Diff** : un exemple remplit les champs ;
- **Snippets** : tant que tu n'en as aucun, un snippet d'exemple s'affiche, grisé ; il n'est enregistré que si tu cliques **Partir de cet exemple** ;
- **Webhooks** : *Un paiement Stripe* montre une requête reçue type (en-têtes, corps) ; son adresse de renvoi se termine par `.invalid`, qui n'existe pas, et **Envoyer** est désactivé.

Un exemple ne fait que remplir des champs : rien n'est enregistré ni envoyé. **Masquer l'aide** replie le bandeau pour cet outil (le choix est retenu), **Aide** le rouvre.

## Snippets

Tes bouts de code réutilisables : un **titre**, un **langage**, le **code** et des **tags** (`react, hook, typescript`). Recherche, **Copier**, **Supprimer**. Un bloc du [terminal intégré](/devforge/getting-started/interface/#le-terminal-intégré) s'enregistre aussi comme snippet.

## Diff texte

Colle un texte **Original** et un texte **Modifié** : le résultat montre côte à côte ce qui est *ajouté*, *supprimé* ou *inchangé*.

## Générateur

| Section | Réglages |
|---|---|
| Mot de passe | longueur, majuscules, minuscules, chiffres, symboles |
| Secret / Token | format (Hex, Base64, alphanumérique) et nombre d'octets |
| UUID | un UUID v4 par clic, les 10 derniers gardés |

**Générer**, puis **Copier**.

## Docs

Des aide-mémoire de commandes pour **Docker**, **React**, **Vue**, **Symfony**, **Node.js**, **Git**, **Shell** et **Python**, avec une recherche. Chaque commande se copie d'un clic.

### Tes propres commandes

**Ajouter une commande** : la commande, une description, et une **catégorie**, l'une des références (Git, Docker…) ou une **Nouvelle catégorie…** qui rejoint la liste de gauche. Tes commandes s'affichent en tête de leur référence, sous **Mes commandes**, et la recherche les trouve ; survole-en une pour **Modifier** ou **Supprimer**.

- **En tapant**, des suggestions complètent la commande : les programmes de ton `PATH` pour le premier mot, les commandes déjà dans la doc, et les sous-commandes connues de `git`, `npm`, `pnpm`, `yarn`, `composer`, `php artisan`, `php bin/console`, `symfony`, `docker`, `docker compose` et `gh`. <kbd>↓</kbd> <kbd>↑</kbd> pour choisir, <kbd>Entrée</kbd> ou <kbd>Tab</kbd> pour prendre.
- **Vérification** : le programme (le premier mot) est cherché sur ce PC. Trouvé, son chemin s'affiche ; sinon, un avertissement dit qu'il n'est pas là, et tu peux quand même enregistrer (une commande d'un serveur distant, par exemple).

Tes commandes sont gardées dans `doc-commands.json`, avec les [sauvegardes et l'export](/devforge/settings/data/) de DevForge. Le [terminal intégré](/devforge/getting-started/interface/#le-terminal-intégré) s'en sert aussi pour ses suggestions.
