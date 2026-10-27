---
title: VPN
description: Gérer les clients WireGuard de ton VPS avec wg-easy, QR codes compris.
---

La page **VPN** gère le WireGuard de ton serveur à travers [wg-easy](https://github.com/wg-easy/wg-easy).

## Prérequis

Un conteneur **wg-easy version 15 ou plus** doit tourner sur le serveur, avec son interface web publiée sur un port du serveur. DevForge le cherche et affiche sa version et son port ; sinon, il indique ce qui manque.

## Se connecter

Saisis l'identifiant de l'**interface wg-easy** (pas celui du serveur). Il est vérifié, puis chiffré par Windows ; il ne sort de DevForge que vers wg-easy, par la session SSH. **Oublier l'identifiant** le retire sans rien modifier sur le serveur.

## Les clients

- La liste montre chaque appareil : *jamais connecté* ou *vu il y a…*, date d'expiration ou *Permanent*, et un interrupteur pour l'activer ou le désactiver.
- **Nouveau** : un nom (par exemple `Mon téléphone`) et une expiration facultative (vide = accès permanent).
- **QR code** : à scanner avec l'application WireGuard du téléphone. Il contient la clé privée de l'appareil : ne le partage pas.
- **Télécharger la configuration** : le fichier `.conf` pour un ordinateur.
- **Supprimer** : l'appareil ne pourra plus se connecter.

**Ouvrir wg-easy** ouvre l'interface complète par un tunnel dans la session SSH.

Le widget **VPN** de l'accueil indique combien d'appareils sont connectés. La palette de commandes crée un client ; Forgy aussi, après ton accord, et la page s'ouvre sur son QR code.
