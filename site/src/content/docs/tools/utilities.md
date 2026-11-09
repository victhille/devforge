---
title: Outils
description: Boîte à outils (JSON, Base64, JWT, regex, hash, UUID, cron, timestamp, URL), snippets, diff texte, générateur de secrets et aide-mémoire.
---

Le groupe **Outils** réunit les petits utilitaires du quotidien. Tout tourne sur ton PC, sans rien envoyer.

## Boîte à outils

Une page, une carte par outil (son nom et ce qu'il fait), et **Chercher un outil…** pour aller vite (<kbd>Entrée</kbd> ouvre le premier trouvé, les flèches passent d'un outil à l'autre) :

| Outil | Ce qu'il fait |
|---|---|
| JSON | **Formater**, **Minifier** ou **Trier les clés** (chaque objet par ordre alphabétique, les listes gardent leur ordre), avec une erreur claire si le JSON est invalide |
| Base64 | **Encoder** / **Décoder** |
| JWT | décode l'en-tête et le contenu (payload) d'un jeton, sans vérifier la signature |
| Regex | un motif et ses flags, testés sur un texte : les correspondances sont surlignées |
| Hash | SHA-1, SHA-256, SHA-384 ou SHA-512 d'un texte |
| UUID | génère plusieurs UUID v4 d'un coup |
| Cron | explique une expression cron (minute, heure, jour, mois, jour de la semaine) et donne les **prochaines exécutions** |
| Timestamp | convertit un timestamp Unix (secondes ou millisecondes) en heure locale et en relatif ; **Maintenant** |
| URL | encode (`encodeURIComponent` ou `encodeURI`), décode, et découpe une URL : protocole, hôte, chemin, paramètres, ancre |

Chaque outil a une carte **Entrée**, où l'on tape ou colle, et une carte **Résultat**, sur fond sombre, avec son bouton de copie.

## Aide et exemples

En tête de chaque outil (les onglets de la boîte à outils, les Snippets, le Diff, le Générateur et les [Webhooks](/devforge/data/webhooks/)), un bandeau dit **à quoi il sert** et **comment s'en servir**, avec des **exemples** à charger d'un clic :

- **Regex** : des exemples grisés dans les champs, et des modèles qui remplissent le motif et le texte de test : *E-mail*, *Date jj/mm/aaaa*, *Lien http(s)*, *Téléphone français* ;
- **JSON**, **Base64**, **JWT**, **Hash**, **URL**, **Timestamp**, **Diff** : un exemple remplit les champs ;
- **Snippets** : tant que tu n'en as aucun, un snippet d'exemple s'affiche, grisé ; il n'est enregistré que si tu cliques **Partir de cet exemple** ;
- **Webhooks** : *Un paiement Stripe* montre une requête reçue type (en-têtes, corps) ; son adresse de renvoi se termine par `.invalid`, qui n'existe pas, et **Envoyer** est désactivé.

Un exemple ne fait que remplir des champs : rien n'est enregistré ni envoyé. **Masquer l'aide** replie le bandeau pour cet outil (le choix est retenu), **Aide** le rouvre.

## Snippets

Tes bouts de code réutilisables : un **titre**, un **langage**, le **code** et des **tags** (`react, hook, typescript`). À gauche, une recherche, les langages en filtres (**Tous**, TypeScript, PHP…) et la liste, chaque snippet avec son langage et son premier tag. À droite, le snippet choisi : ses tags, son code en couleurs, **Copier** et **Nouveau snippet** ; le menu **⋯** le **Modifie** (le formulaire, puis **Enregistrer**) ou le **Supprime**, après confirmation. Un bloc du [terminal intégré](/devforge/getting-started/interface/#le-terminal-intégré) s'enregistre aussi comme snippet.

## Diff texte

Colle un texte **Original** et un texte **Modifié** : le nombre de lignes retirées et ajoutées s'affiche, puis les deux versions **côte à côte**, avec leurs numéros de ligne, les lignes retirées en rouge à gauche et les lignes ajoutées en vert à droite. **Unifié** les montre en une seule liste, avec `+` et `-` (le choix est retenu). **Ignorer les espaces** compte comme identiques les lignes qui ne diffèrent que par l'indentation ou des espaces en trop. **Inverser** échange les deux textes, **Effacer** les vide.

## Générateur

Un onglet par sorte de valeur, avec ses **Réglages** à gauche et le **Résultat** à droite :

| Onglet | Réglages |
|---|---|
| Mot de passe | longueur, majuscules, minuscules, chiffres, symboles |
| Secret d’appli / token | format (Base64, Hex, alphanumérique) et nombre d'octets. En Base64 : **Préfixe base64: (APP_KEY de Laravel)** donne une clé prête pour le `.env` de Laravel, **Sûr pour une URL** remplace `+` et `/` par `-` et `_` |
| UUID | combien en tirer d'un coup (1 à 20), **Tout copier** |

Une valeur est tirée dès l'ouverture, et de nouveau quand un réglage change ; **Régénérer** en tire une autre, **Copier** la copie. Le résultat dit sa force en bits. Les réglages sont retenus.

## Docs

Des aide-mémoire de commandes pour **Docker**, **React**, **Vue**, **Symfony**, **Node.js**, **Git**, **Shell** et **Python** : à gauche, chaque référence avec son nombre de commandes ; à droite, ses sections en cartes, une ligne par commande (la commande, ce qu'elle fait, la copie). La recherche filtre la référence ouverte.

### Tes propres commandes

**Ajouter une commande** : la commande, une description, et une **catégorie**, l'une des références (Git, Docker…) ou une **Nouvelle catégorie…** qui rejoint la liste de gauche. Tes commandes s'affichent en tête de leur référence, sous **Mes commandes**, et la recherche les trouve ; survole-en une pour **Modifier** ou **Supprimer**.

- **En tapant**, des suggestions complètent la commande : les programmes de ton `PATH` pour le premier mot, les commandes déjà dans la doc, et les sous-commandes connues de `git`, `npm`, `pnpm`, `yarn`, `composer`, `php artisan`, `php bin/console`, `symfony`, `docker`, `docker compose` et `gh`. <kbd>↓</kbd> <kbd>↑</kbd> pour choisir, <kbd>Entrée</kbd> ou <kbd>Tab</kbd> pour prendre.
- **Vérification** : le programme (le premier mot) est cherché sur ce PC. Trouvé, son chemin s'affiche ; sinon, un avertissement dit qu'il n'est pas là, et tu peux quand même enregistrer (une commande d'un serveur distant, par exemple).

Tes commandes sont gardées dans `doc-commands.json`, avec les [sauvegardes et l'export](/devforge/settings/data/) de DevForge. Le [terminal intégré](/devforge/getting-started/interface/#le-terminal-intégré) s'en sert aussi pour ses suggestions.
