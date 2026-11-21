---
title: Expo
description: Lancer une appli React Native avec Expo, l'ouvrir sur le téléphone avec le QR code, envoyer les commandes de Metro et aligner les paquets sur le SDK.
---

La page **Expo** (menu **Développement**) lance tes applis React Native avec [Expo](https://expo.dev) et les ouvre sur ton téléphone, sans terminal.

## Les projets Expo

À gauche, chaque dossier de tes [projets](/devforge/dev/projects/) qui dépend du paquet `expo` : le projet lui-même, ou une appli de son monorepo (`apps/…`, `packages/…`). La ligne montre le dossier et la version du SDK (*SDK 54*). Un point vert dit lequel tourne.

## Démarrer le serveur

Choisis comment ouvrir l'appli, puis **Démarrer** :

| Réglage | Choix |
|---|---|
| Ouvrir dans | **Expo Go** (l'appli d'Expo sur le téléphone) ou **Build de dev** (un build de développement déjà installé, qui demande `expo-dev-client`) |
| Connexion | **Wi-Fi local** (le téléphone et le PC sur le même réseau), **Tunnel** (n'importe quel réseau, par le service en ligne d'Expo) ou **Ce PC seulement** (un émulateur Android, le navigateur) |
| Port | 8081 par défaut, de 1024 à 65535. S'il est pris, ou réservé par Windows pour WSL ou Hyper-V, Metro prend le suivant qui est libre, et le journal le dit |
| Vider le cache au démarrage | relance Metro sans son cache |

DevForge lance `npx expo start` dans le dossier de l'appli, avec ces réglages. Un seul serveur Expo tourne à la fois : en démarrer un autre arrête le premier. Les réglages se changent serveur arrêté.

En **Wi-Fi local**, DevForge donne au téléphone l'adresse de la vraie carte réseau du PC (Wi-Fi d'abord, puis Ethernet), jamais celle d'une carte virtuelle (WSL, Hyper-V, VirtualBox, VPN) : le téléphone ne pourrait pas la joindre, et Expo Go afficherait « Something went wrong ». Le journal de Metro dit l'adresse choisie. Pour en imposer une autre, définis `REACT_NATIVE_PACKAGER_HOSTNAME` avant de lancer DevForge.

Le **tunnel** demande le paquet `@expo/ngrok`. Quand Expo propose de l'installer, DevForge affiche **Installer @expo/ngrok**, qui répond oui à sa place.

## Le QR code

Dès que Metro répond, le QR code de l'adresse (`exp://…`) apparaît, avec l'adresse à copier :

- avec **Expo Go**, scanne-le avec Expo Go (Android) ou l'appareil photo (iPhone) ;
- avec un **build de dev**, scanne-le avec l'appareil photo : le build installé s'ouvre sur ce serveur.

Le QR code est dessiné dans DevForge : l'adresse n'est envoyée nulle part.

## Les commandes de Metro

Les boutons envoient les touches d'Expo, comme dans un terminal :

| Bouton | Touche |
|---|---|
| Ouvrir sur Android | `a` |
| Ouvrir dans le navigateur | `w` |
| Recharger l'appli | `r` |
| Menu de dev | `m` |
| Outils de dev | `j` |
| Changer Go / build | `s` |

Dessous, le **journal de Metro**. Quand une erreur y apparaît, **Demander à Forgy d'expliquer l'erreur** lui envoie la fin du journal, secrets reconnus masqués.

## Versions des paquets

**Vérifier** lance `npx expo install --check` : la liste des paquets qui ne suivent pas le SDK, avec la version installée et celle attendue. **Aligner les versions** lance `npx expo install --fix` après confirmation : `package.json` et le lockfile changent.

## Ce qui sort du PC

- En **Wi-Fi local** et **Ce PC seulement**, rien ne sort du réseau local.
- Le **tunnel** passe par le service en ligne d'Expo (ngrok).
- **Demander à Forgy** envoie la fin du journal à ton fournisseur d'IA, seulement quand tu cliques (voir [ce que Forgy envoie](/devforge/privacy/#ce-que-forgy-envoie)).
