---
title: Ports
description: Les ports en écoute sur ton PC, le processus derrière chacun, et Libérer pour arrêter celui qui bloque.
---

La page **Ports** liste les ports en écoute sur ce PC : le **port**, le **processus** et son **PID**.

- **Dev** n'affiche que les ports au-dessus de 1024 tenus par un outil de dev (Node, Bun, Deno, Python, PHP, Java, Go, .NET, bases de données, nginx, Caddy, Docker…) ; **Tous** les montre tous.
- **Libérer** arrête le processus qui tient le port, après confirmation : « Arrêter « node » (PID 12345) pour libérer le port 3000 ? ».
- **Actualiser** relit la liste.

DevForge refuse d'arrêter un processus système de Windows.

## Ailleurs

- Le widget **Ports** de l'accueil montre les ports de dev en écoute.
- L'onglet **Ports & domaines** de chaque [fiche projet](/devforge/dev/projects/) montre les ports du projet, libres ou pris.
- Forgy peut proposer de libérer un port, à valider ; il ne touche jamais un service Windows ni DevForge.
