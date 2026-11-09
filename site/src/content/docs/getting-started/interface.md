---
title: Se repérer
description: L'accueil, le menu, les favoris, la palette de commandes, le terminal et les raccourcis de DevForge.
---

## L'accueil

![L'accueil, avec le projet actif, Git et l'activité](../../../assets/screens/home-fr.png)

L'accueil salue selon l'heure. Sous la salutation, des **pastilles** disent où tu en es : conteneurs en ligne (ou « Rien ne tourne »), dépôts modifiés, dépôts à pousser, état du serveur.

Dessous, deux cartes :

- **Reprendre** : les trois projets ouverts en dernier, avec leur chemin, l'état de leur dépôt (modifié, à pousser, à jour) et la date de la dernière ouverture. **Ouvrir** mène à la fiche du projet ; **Tous les projets** à la liste.
- **Forgy** : un champ pour lui poser une question, et trois demandes toutes faites sur le [projet actif](#le-projet-actif) : **Message de commit**, **Revue des changements**, **Expliquer le projet**. Chacune ouvre le panneau de Forgy et part dans une nouvelle conversation.

Le reste de l'accueil est fait de **widgets** :

| Widget | Ce qu'il montre |
|---|---|
| Projet actif | le projet en cours, ses actions rapides (ouvrir, terminal, scripts) |
| Docker | les projets Compose et leurs services, avec Démarrer / Arrêter / Logs |
| VPS | la connexion SSH, la mémoire et le disque du serveur |
| Git | les dépôts modifiés ou à pousser, **Tout récupérer (fetch)** |
| Ports | les ports de dev en écoute |
| Activité | tes dernières actions (commit, Compose, déploiement, actions de Forgy…) |
| Commits | tes commits de la semaine et les branches à pousser (voir [Activité](/devforge/dev/activity/)) |
| Santé du VPS, Services du VPS, Sauvegardes, n8n, VPN | un résumé de chaque page serveur |

**Personnaliser** permet de glisser les widgets (ou <kbd>Alt</kbd> + <kbd>↑</kbd> <kbd>↓</kbd> sur leur poignée), de les passer en pleine ou demi-largeur, d'en retirer ou d'en ajouter. **Par défaut** remet la disposition d'origine.

### Le projet actif

Un projet peut être **actif** : Forgy et le widget de bureau s'y rapportent. Il devient actif quand tu l'ouvres, ou se choisit dans le widget *Projet actif*.

## Le menu

Le menu de gauche est un rail d'icônes : l'**Accueil**, puis six groupes. Un clic sur un groupe affiche ses pages dans le panneau d'à côté, sans quitter la page ouverte. Le rail marque en orange l'endroit de la page ouverte : l'Accueil quand elle est dans tes favoris et que le panneau les montre, son groupe sinon.

Sous l'Accueil, le panneau montre tes **favoris** et tes trois **projets récents** (tous les autres sont sur la page [Projets](/devforge/dev/projects/)). Devant chaque projet, un point dit l'état de son dépôt : orange s'il a des fichiers modifiés (leur nombre est à droite), vert s'il est à jour, gris si le dossier n'est pas un dépôt Git. En bas du panneau, une note : le rappel de <kbd>Ctrl</kbd> <kbd>K</kbd> sous l'Accueil, le serveur suivi sous Serveurs et Mise en ligne.

| Groupe | Pages |
|---|---|
| Développement | [Projets](/devforge/dev/projects/), [Nouveau projet](/devforge/dev/new-project/), [Git](/devforge/dev/git/), [Activité](/devforge/dev/activity/), [Lanceur](/devforge/dev/stacks/) |
| Serveurs | [SSH / VPS](/devforge/servers/ssh/), [Santé](/devforge/servers/health/), [Services](/devforge/servers/services/), [Sauvegardes](/devforge/servers/backups/), [Monitoring](/devforge/servers/monitoring/) |
| Mise en ligne | [Déploiement](/devforge/online/deploy/), [Docker](/devforge/dev/docker/), [n8n](/devforge/online/n8n/), [VPN](/devforge/online/vpn/), [Page de statut](/devforge/online/status-page/) |
| Données & API | [Base de données](/devforge/data/database/), [API Tester](/devforge/data/api-tester/), [Webhooks](/devforge/data/webhooks/), [Logs](/devforge/data/logs/) |
| Système | [Environnement](/devforge/system/environment/), [Ports](/devforge/system/ports/), [Variables .env](/devforge/system/env-files/), [Domaines locaux](/devforge/system/domains/), [Nettoyage disque](/devforge/system/cleaner/) |
| Outils | [Boîte à outils, Snippets, Diff texte, Générateur, Docs](/devforge/tools/utilities/) |

**Paramètres** est épinglé en bas du rail ; son panneau liste les [sections des Paramètres](/devforge/settings/general/). <kbd>Ctrl</kbd> <kbd>B</kbd> replie ou rouvre le panneau ; un nouveau clic sur le groupe affiché le replie aussi. Au clavier, le rail se parcourt avec les flèches, <kbd>Entrée</kbd> affiche le groupe et <kbd>Tab</kbd> passe à ses pages.

Tant qu'aucun serveur n'est configuré, les pages qui en demandent un (Santé, Services, Sauvegardes, n8n, VPN, Page de statut) sont masquées ; le groupe indique « N de plus avec un serveur ».

### L'aide de chaque page

Le bouton **?** de la barre de titre (ou <kbd>F1</kbd>) ouvre, sur ce site, la documentation de la page affichée, dans la langue de l'interface. Les pages qui attendent un compte ou un serveur proposent aussi **Comment faire**, qui mène à [Connexions](/devforge/getting-started/connections/).

### Favoris

Survole une page et clique sur ☆ pour l'épingler sous l'Accueil (10 favoris au plus). Glisse-les pour les réordonner (ou <kbd>Alt</kbd> + <kbd>↑</kbd> <kbd>↓</kbd>). Par défaut : Projets, Docker, Base de données et API Tester ; **Remettre les favoris par défaut** y revient.

## La palette de commandes

![La palette de commandes](../../../assets/screens/palette-fr.png)

<kbd>Ctrl</kbd> <kbd>K</kbd> ouvre une recherche sur tout DevForge : **pages**, **projets** (ouvrir dans VS Code, détails, dossier, terminal), **scripts** de tes projets, **stacks** à démarrer, **serveurs** (tableau de bord), et des **actions** :

- ouvrir ou redémarrer n8n, ouvrir wg-easy, créer un client VPN ;
- sauvegarder le serveur maintenant, copier la dernière sauvegarde sur ce PC, voir la santé du serveur ;
- ouvrir un service web du serveur ;
- récupérer tous les dépôts Git (fetch) ;
- passer en thème clair ou sombre, activer ou couper le mode compact ;
- chercher une mise à jour de DevForge.

<kbd>↑</kbd> <kbd>↓</kbd> pour naviguer, <kbd>Entrée</kbd> pour lancer. Une action sensible (redémarrer n8n, sauvegarder) demande confirmation.

## Le lanceur global

Le **lanceur global** est une barre de recherche par-dessus n'importe quelle application, même quand DevForge est réduit dans la zone de notification. Raccourci par défaut : <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>Espace</kbd>.

Tape un projet, une page ou une action ; ce que tu lances souvent remonte en premier. Il comprend aussi :

- un **calcul** (`12*7`), un **timestamp**, une **date**, du **Base64**, une **couleur** : le résultat se copie ;
- une question : **Demander à Forgy « … »**.

Une action sensible demande <kbd>Entrée</kbd> une seconde fois. Le lanceur se règle dans **Paramètres › Général** : activer, changer de raccourci (avec <kbd>Ctrl</kbd>, <kbd>Alt</kbd> ou <kbd>Win</kbd>). Pour qu'il soit toujours prêt, DevForge propose de démarrer avec Windows, réduit.

## Le terminal intégré

<kbd>Ctrl</kbd> <kbd>`</kbd> ouvre le terminal en bas de la fenêtre, avec des onglets (**+** pour en ouvrir un). **Masquer**, à droite des onglets, le cache sans arrêter ses shells ; fermer le dernier onglet le ferme entièrement, et il repart sur un shell neuf à la prochaine ouverture. Chaque commande devient un **bloc** : sa sortie, son code de retour et sa durée.

- Sur un bloc : **Copier la sortie**, **Relancer**, **Enregistrer comme snippet**, **Expliquer avec Forgy** (proposé quand la commande échoue).
- <kbd>↑</kbd> <kbd>↓</kbd> parcourent l'historique du dossier, <kbd>Ctrl</kbd> <kbd>R</kbd> y cherche.
- Une ligne qui commence par `#` est une question pour Forgy.
- Pendant qu'un programme tourne, tape dans le bloc, ou **Arrêter** (<kbd>Ctrl</kbd> <kbd>C</kbd>).

### Les suggestions

Pendant que tu tapes, la **suite probable** de la ligne s'affiche en gris après le curseur, comme dans le shell fish. Elle vient, dans l'ordre :

1. des **scripts du projet** du dossier où tu es (`npm run dev`, `pnpm build`…, selon son gestionnaire de paquets) ;
2. de l'**historique** de ce dossier, le plus récent d'abord ;
3. des commandes de la page [Docs](/devforge/tools/utilities/#docs), les tiennes comprises.

<kbd>→</kbd> ou <kbd>Fin</kbd> l'accepte. Si tu continues de taper, elle suit ou disparaît ; <kbd>Entrée</kbd> lance ce qui est tapé, pas la suggestion. Tout se calcule sur ton PC, sur des listes déjà chargées : la saisie n'est pas ralentie et rien n'est envoyé. **Suggestions dans le terminal**, dans [Paramètres › Général](/devforge/settings/general/), les coupe.

## Raccourcis

| Raccourci | Effet |
|---|---|
| <kbd>Ctrl</kbd> <kbd>K</kbd> | palette de commandes |
| <kbd>Ctrl</kbd> <kbd>J</kbd> | ouvrir / fermer Forgy |
| <kbd>Ctrl</kbd> <kbd>B</kbd> | replier / rouvrir le panneau du menu |
| <kbd>F1</kbd> | la documentation de la page affichée |
| <kbd>Ctrl</kbd> <kbd>`</kbd> | terminal intégré |
| <kbd>Ctrl</kbd> <kbd>Entrée</kbd> | exécuter la requête SQL |
| <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>Espace</kbd> | lanceur global (de n'importe où) |
| <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>J</kbd> | Forgy sur le bureau, quand le lanceur a pris <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>Espace</kbd> |
