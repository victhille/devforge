---
title: Installation
description: Installer DevForge sur Windows, passer l'alerte SmartScreen et recevoir les mises à jour.
---

DevForge est une application de bureau pour **Windows 10 et 11 (64 bits)**. Elle est gratuite, open source (licence MIT) et ne demande aucun compte.

## Télécharger

Prends l'installeur sur la page [Télécharger](/devforge/download/) ou directement dans les [releases GitHub](https://github.com/victhille/devforge/releases/latest). Il s'appelle `DevForge-Setup-vX.Y.Z.exe`, où `X.Y.Z` est le numéro de version.

## L'alerte SmartScreen

L'installeur n'est pas signé. Au premier lancement, Windows SmartScreen peut afficher :

> Windows a protégé votre ordinateur

1. Clique sur **Informations complémentaires**.
2. Vérifie que l'application s'appelle bien `DevForge-Setup-vX.Y.Z.exe`.
3. Clique sur **Exécuter quand même**.

:::tip[Pourquoi cette alerte ?]
SmartScreen se méfie des programmes sans certificat de signature (payant) ou encore peu téléchargés. Le code source et la façon dont l'installeur est construit sont publics sur [GitHub](https://github.com/victhille/devforge) : chaque release est produite par GitHub Actions depuis le dépôt.
:::

## L'installeur

L'installeur te laisse choisir le dossier d'installation. DevForge s'ajoute au menu Démarrer et sur le Bureau. À la fin, il s'ouvre sur l'[écran de bienvenue](/devforge/getting-started/first-launch/).

## Où sont les données

Tout reste sur ton PC, dans le dossier de données de DevForge (`%APPDATA%\DevForge`) : réglages, projets enregistrés, connexions, historique, journal. Les clés, jetons et mots de passe y sont **chiffrés par Windows** et ne se réaffichent jamais. **Paramètres › Données** montre ce dossier et sa taille, voir [Données, export et remise à zéro](/devforge/settings/data/).

## Mises à jour automatiques

- DevForge regarde les releases GitHub **15 secondes après son démarrage**, puis **toutes les 6 heures**.
- Une nouvelle version se télécharge en arrière-plan. Elle s'installe **au prochain redémarrage**, ou tout de suite avec **Redémarrer et mettre à jour** : sans fenêtre d'installation, DevForge se ferme et se relance sur la nouvelle version.
- Le menu affiche aussi un bouton **Mettre à jour (vX.Y.Z)** quand une version est prête.
- Après la mise à jour, une fenêtre **Quoi de neuf** résume la version (désactivable).

Tout se règle dans **Paramètres › Mises à jour** : canal **Stable** (versions finales) ou **Bêta** (aussi les préversions, plus tôt mais parfois avec des bugs), bouton **Vérifier**, notes de version dans la langue de l'application. Voir [Paramètres](/devforge/settings/general/#mises-à-jour).

## Désinstaller

Passe par **Paramètres Windows › Applications › Applications installées › DevForge › Désinstaller**. Pour aussi effacer tes données avant, utilise **Paramètres › Données › Tout effacer** dans DevForge.
