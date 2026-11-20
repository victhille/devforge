---
title: Installation
description: Installer DevForge sur Windows, passer l'alerte SmartScreen et recevoir les mises à jour.
---

DevForge est une application de bureau pour **Windows 10 et 11 (64 bits)**. Elle est gratuite, open source (licence GPL-3.0) et ne demande aucun compte.

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

L'installeur demande d'abord pour qui installer :

- **pour moi seulement** (conseillé) : dans ton profil Windows, sans droits d'administrateur ;
- **pour tous les utilisateurs** du PC : dans `Program Files`, Windows demande alors l'autorisation, à l'installation comme à chaque mise à jour.

Tu choisis ensuite le dossier d'installation. DevForge s'ajoute au menu Démarrer et sur le Bureau. À la fin, il s'ouvre sur l'[écran de bienvenue](/devforge/getting-started/first-launch/).

## Où sont les données

Tout reste sur ton PC, dans le dossier de données de DevForge (`%APPDATA%\DevForge`) : réglages, projets enregistrés, connexions, historique, journal. Les clés, jetons et mots de passe y sont **chiffrés par Windows** et ne se réaffichent jamais. **Paramètres › Données** montre ce dossier et sa taille, voir [Données, export et remise à zéro](/devforge/settings/data/).

## Mises à jour automatiques

- DevForge regarde les releases GitHub **15 secondes après son démarrage**, puis **toutes les 6 heures**.
- Une nouvelle version se télécharge en arrière-plan, dans un bloc en bas à droite : avancement, taille et temps restant. Tu peux continuer à travailler, ou le réduire en pastille dans la barre de titre.
- Une fois prête, elle s'installe avec **Redémarrer et mettre à jour**, ou **au prochain redémarrage** si tu choisis **Plus tard**. Le bloc annonce l'installation, puis DevForge se ferme. Pendant que Windows remplace ses fichiers, sans fenêtre d'installeur, une petite fenêtre « Mise à jour de DevForge » montre que l'installation avance. Seule l'autorisation de Windows est demandée, si DevForge est installé pour tous les utilisateurs. Puis la fenêtre « Mise à jour installée » s'affiche le temps que DevForge se rouvre.
- Après la mise à jour, une fenêtre **Quoi de neuf** résume la version (désactivable).

:::caution[Tu as une version 1.x à 4.x ?]
Les numéros sont repartis de 0.x avant la sortie publique. Une ancienne version 1.x à 4.x prend les nouvelles pour des versions plus anciennes et ne se met donc plus à jour seule. Désinstalle-la, puis installe la dernière : tes données restent, dans `%APPDATA%\DevForge`.
:::

Tout se règle dans **Paramètres › Mises à jour** : canal **Stable** (versions finales) ou **Bêta** (aussi les préversions, plus tôt mais parfois avec des bugs), bouton **Vérifier**, notes de version dans la langue de l'application. Voir [Paramètres](/devforge/settings/general/#mises-à-jour).

## Désinstaller

Passe par **Paramètres Windows › Applications › Applications installées › DevForge › Désinstaller**. La désinstallation retire l'application, les mises à jour déjà téléchargées et le lancement au démarrage de Windows.

Tes données restent, pour une réinstallation plus tard : le dossier `%APPDATA%\DevForge` (réglages, projets enregistrés, connexions, modèles de dictée) et les domaines locaux ajoutés au fichier `hosts`. Pour les effacer, utilise d'abord **Paramètres › Données › Tout effacer** dans DevForge, et retire tes domaines dans **Domaines locaux**.
