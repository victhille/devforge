---
title: Domaines locaux
description: shop.test au lieu de localhost:3000, avec un proxy local et le fichier hosts.
---

La page **Domaines locaux** donne un nom à tes serveurs de dev : `shop.test` au lieu de `localhost:3000`.

## Ajouter un domaine

**Nouveau domaine** (en haut à droite) ouvre le formulaire : un **domaine** qui finit par `.test` ou `.localhost` (par exemple `shop.test`) et le **port** local, puis **Ajouter**. **Détectés dans tes projets** propose des couples domaine / port tirés de tes projets.

Trois cartes résument l'état : le **proxy**, le **fichier hosts** et le nombre de domaines actifs (« 2 domaine(s) actif(s) sur 3 »). Les domaines s'affichent en tableau : le domaine, le port visé, le **projet** qui tient ce port, son **état** (*répond* quand un serveur écoute sur le port, *rien sur le port* sinon, *désactivé* quand il est coupé) et les actions : ouvrir l'adresse, l'interrupteur qui l'active ou le désactive, la corbeille au survol.

## Le proxy

DevForge fait tourner un petit proxy local qui envoie chaque domaine vers son port. Il **démarre tout seul** dès qu'un domaine est activé ; l'en-tête indique *Proxy actif sur le port 80*.

Si le port 80 est déjà pris, le proxy prend le port 8088 et les adresses ont besoin de lui (`http://shop.test:8088`).

Quand le serveur de dev ne répond pas, le proxy affiche une page qui le dit (« Nothing answers on port 3000 »).

## Le fichier hosts

- Les domaines en `.localhost` marchent **sans toucher au fichier hosts** : les navigateurs les envoient déjà vers `127.0.0.1`.
- Les domaines en `.test` doivent être dans le fichier hosts de Windows. Quand il n'est pas à jour, **Mettre à jour (admin)** l'écrit, après la demande d'autorisation de Windows.

L'onglet **Ports & domaines** d'une [fiche projet](/devforge/dev/projects/) lie un domaine aux ports du projet.
