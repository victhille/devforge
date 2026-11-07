---
title: Données, export et remise à zéro
description: Où DevForge range tes données, ses sauvegardes automatiques, le journal, l'export et l'import de la configuration, et Tout effacer.
---

**Paramètres › Données**. Tout reste sur cet ordinateur.

## Dossier des données

Le chemin du dossier (`%APPDATA%\DevForge`), sa taille et la version du format de données. **Ouvrir le dossier** l'affiche dans l'Explorateur.

Les clés, jetons et mots de passe y sont chiffrés par Windows (DPAPI) : copiés sur un autre PC ou un autre compte Windows, ils ne sont pas lisibles.

## Sauvegardes

DevForge fait une sauvegarde de ses données **avant chaque changement du format de données** (lors d'une mise à jour) et en garde **les 5 dernières**. **Sauvegarder maintenant** en fait une à la main.

**Restaurer** remet les données d'une date. Les données actuelles sont sauvegardées avant, puis DevForge redémarre.

## Journal local

Erreurs et évènements, secrets masqués, utile pour un rapport de bug. **Ouvrir le journal** l'affiche. Le rapport de diagnostic (dans **À propos**) en reprend les dernières lignes.

## Exporter ou importer ma configuration

- **Exporter** écrit dans un fichier tes projets, serveurs, bases, réglages… pour les reprendre sur un autre PC. **Aucun secret n'y est** : mots de passe, jetons et clés seront à ressaisir dans [Connexions](/devforge/getting-started/connections/).
- **Importer…** remplace ta configuration actuelle par celle du fichier. Une sauvegarde est faite avant, puis DevForge redémarre.

## Effacer l'historique de surveillance

Efface les 7 jours d'historique de [surveillance des serveurs](/devforge/servers/monitoring/#les-serveurs) : les courbes repartent de zéro, les réglages restent.

## Tout effacer

**Tout effacer** remet DevForge à zéro : connexions, clés, projets, historique, journal, sauvegardes et réglages. DevForge redémarre sur l'[écran de bienvenue](/devforge/getting-started/first-launch/).

- Tes **dossiers de projets ne sont pas touchés**.
- C'est **sans retour possible** : tape le mot `effacer` pour confirmer.

Pour garder une copie de ta configuration avant, utilise **Exporter**.
