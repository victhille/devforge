---
title: Données, export et remise à zéro
description: Où DevForge range tes données, ses sauvegardes automatiques, le journal, l'export et l'import de la configuration, et Tout effacer.
---

**Paramètres › Données**. Tout reste sur cet ordinateur. La page tient en quatre cartes : **Stockage** (dossier, journal, historique de surveillance), **Sauvegardes**, **Exporter ou importer ma configuration** et **Zone sensible**.

## Dossier des données

Le chemin du dossier (`%APPDATA%\DevForge`), sa taille et la version du format de données. **Ouvrir le dossier** l'affiche dans l'Explorateur.

Les clés, jetons et mots de passe y sont chiffrés par Windows (DPAPI) : copiés sur un autre PC ou un autre compte Windows, ils ne sont pas lisibles.

## Sauvegardes

DevForge fait une sauvegarde de ses données **avant chaque changement du format de données** (lors d'une mise à jour) et en garde **les 5 dernières**. **Sauvegarder maintenant**, en haut de la carte, en fait une à la main.

Chaque sauvegarde montre sa date, sa raison (*manuelle*, *avant le format v12*, *avant une restauration*) et sa taille. **Restaurer** remet les données de cette date. Les données actuelles sont sauvegardées avant, puis DevForge redémarre.

## Journal local

Erreurs et évènements, secrets masqués, utile pour un rapport de bug. **Ouvrir le journal** l'affiche. Le [rapport de diagnostic](/devforge/settings/general/#à-propos), dans **À propos**, en reprend les dernières lignes.

## Exporter ou importer ma configuration

Sur la ligne **Vers un autre PC** :

- **Exporter** écrit dans un fichier tes projets, serveurs, bases, réglages… pour les reprendre sur un autre PC. **Aucun secret n'y est** : mots de passe, jetons et clés seront à ressaisir dans [Connexions](/devforge/getting-started/connections/).
- **Importer…** remplace ta configuration actuelle par celle du fichier. Une sauvegarde est faite avant, puis DevForge redémarre.

## Effacer l'historique de surveillance

**Effacer…** efface, après confirmation, les 7 jours d'historique de [surveillance des serveurs](/devforge/servers/monitoring/#les-serveurs) : les courbes repartent de zéro, les réglages restent.

## Tout effacer

Dans la carte **Zone sensible**, **Tout effacer…** remet DevForge à zéro : connexions, clés, projets, historique, journal, sauvegardes et réglages. DevForge redémarre sur l'[écran de bienvenue](/devforge/getting-started/first-launch/).

- Tes **dossiers de projets ne sont pas touchés**.
- C'est **sans retour possible** : le bouton ouvre un champ où taper le mot `effacer`, puis **Tout effacer** confirme (**Annuler** referme le champ).

Pour garder une copie de ta configuration avant, utilise **Exporter**.
