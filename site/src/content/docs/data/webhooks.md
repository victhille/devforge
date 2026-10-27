---
title: Webhooks
description: Capturer et inspecter les webhooks entrants sur ton PC, et les rejouer.
---

Le **Testeur de webhooks** lance un petit serveur local qui capture toutes les requêtes reçues, pour voir exactement ce qu'envoient Stripe, GitHub ou ton propre service.

## Démarrer

Choisis un port (9999 par défaut) et **Démarrer**. Le serveur écoute sur `http://127.0.0.1:9999` : il n'est accessible que depuis ce PC.

Pour recevoir des webhooks d'Internet, expose-le avec un tunnel. DevForge te donne la commande à copier :

```bash
cloudflared tunnel --url http://127.0.0.1:9999
```

## Inspecter

Chaque requête apparaît en direct : méthode, chemin, heure, **Headers** et **Body** (tronqué à 1 Mo). **Vider** efface la liste.

## Répondre

**Réponse** règle ce que le serveur renvoie aux appelants (statut, `Content-Type`, corps), par exemple pour simuler une erreur.

## Rejouer

**Rejouer** renvoie la même méthode, les mêmes headers et le même body, vers ton application par exemple. Sans chemin, le chemin capturé est réutilisé.
