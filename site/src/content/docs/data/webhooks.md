---
title: Webhooks
description: Capturer et inspecter les webhooks entrants sur ton PC, et les rejouer.
---

La page **Webhooks** lance un petit serveur local qui capture toutes les requêtes reçues, pour voir exactement ce qu'envoient Stripe, GitHub ou ton propre service.

## Démarrer

Choisis un port (9999 par défaut) et **Démarrer**, en haut à droite (**Arrêter** ensuite). Le serveur écoute sur `http://127.0.0.1:9999` : il n'est accessible que depuis ce PC.

La carte sous l'aide montre l'**adresse locale** (à copier), l'adresse où les appels sont **rejoués** et la **réponse** renvoyée. Pour recevoir des webhooks d'Internet, expose le serveur avec un tunnel ; DevForge te donne la commande à copier :

```bash
cloudflared tunnel --url http://127.0.0.1:9999
```

## Inspecter

Un badge à côté du titre dit si le serveur est **En écoute** ou **Arrêté**. Chaque appel apparaît en direct dans **Reçus** : la méthode, son nom (le type d'événement Stripe, l'événement et le dépôt GitHub, sinon le chemin) et l'heure. Le haut de la liste compte les appels du jour ; **Vider** l'efface.

Un clic sur un appel l'ouvre à droite, avec qui l'a envoyé et sa taille : **Corps** (tronqué à 1 Mo), **En-têtes** et **Réponse de l'appli**. **curl** copie l'appel en commande.

## Répondre

Le statut à côté de **réponse** règle ce que le serveur renvoie aux appelants (statut, `Content-Type`, corps), par exemple pour simuler une erreur.

## Rejouer

**Rejouer** renvoie la même méthode, les mêmes en-têtes et le même corps vers l'adresse de rejeu (ton application, par exemple). Sans chemin, le chemin reçu est réutilisé. Ce que répond ton application s'affiche dans **Réponse de l'appli**.
