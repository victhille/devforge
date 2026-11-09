---
title: VPN
description: Gérer les clients WireGuard de ton VPS avec wg-easy, QR codes compris.
---

La page **VPN** gère le WireGuard de ton serveur à travers [wg-easy](https://github.com/wg-easy/wg-easy).

## Prérequis

Un conteneur **wg-easy version 15 ou plus** doit tourner sur le serveur, avec son interface web publiée sur un port du serveur. DevForge le cherche et affiche sa version et son port ; sinon, il indique ce qui manque.

## Se connecter

Saisis l'identifiant de l'**interface wg-easy** (pas celui du serveur). Il est vérifié, puis chiffré par Windows ; il ne sort de DevForge que vers wg-easy, par la session SSH. **Oublier l'identifiant** le retire sans rien modifier sur le serveur. Il est aussi oublié si le serveur change d'hôte, de port ou d'utilisateur, ou s'il est retiré : il faut alors le saisir à nouveau.

## Les clients

- Le tableau montre chaque appareil : son adresse, sa dernière connexion (*connecté* s'il vient de se connecter, sinon depuis quand), ses échanges, sa date d'expiration s'il en a une, et l'interrupteur **Actif**.
- Un clic sur un appareil affiche à côté son **code QR**, à scanner avec l'application WireGuard du téléphone. Il contient la clé privée de l'appareil : il se ferme tout seul au bout de 2 minutes, ne le partage pas.
- Sous le code : **Télécharger le fichier .conf** pour un ordinateur, et **Supprimer** (l'appareil ne pourra plus se connecter).
- **Nouveau client** (en haut) : un nom (par exemple `Mon téléphone`) et une expiration facultative (vide = accès permanent). Son code QR s'affiche aussitôt.

Le menu **⋯** : **Ouvrir wg-easy** (l'interface complète, par un tunnel dans la session SSH), **Actualiser** et **Oublier l'identifiant**.

Le widget **VPN** de l'accueil indique combien d'appareils sont connectés. La palette de commandes crée un client ; Forgy aussi, après ton accord, et la page s'ouvre sur son QR code.
