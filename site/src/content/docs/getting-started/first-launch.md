---
title: Premier lancement
description: Les cinq étapes de l'écran de bienvenue de DevForge.
---

Au tout premier lancement, DevForge ouvre un accueil en **cinq étapes**. Rien n'est branché d'avance : DevForge ne connaît que ce que tu lui donnes, et tout est facultatif. **Passer**, en haut à droite, ferme l'accueil à n'importe quelle étape ; tout se retrouve ensuite dans les [Paramètres](/devforge/settings/general/).

## 1. Bienvenue

Choisis la langue : **Français** ou **English**. Elle s'applique tout de suite à l'interface, aux notes de version et aux réponses de Forgy. Par défaut, c'est celle de Windows (français si Windows est en français, anglais sinon).

L'écran rappelle ce que fait DevForge : tes projets au même endroit, Docker et Compose en local et sur ton serveur, bases de données, logs et API Tester, serveurs SSH surveillés, n8n et Vercel. **Lire la prise en main sur le site** ouvre cette page.

## 2. Où sont tes projets ?

DevForge propose un dossier de projets (par défaut `Development` dans ton dossier personnel). **Parcourir** en choisit un autre ; **Chercher** le parcourt sur **deux niveaux** et repère les projets (un framework connu ou un fichier de paquets).

Les projets trouvés sont tous cochés ; décoche ceux que tu ne veux pas et clique sur **Ajouter N projet(s)**. Le dossier devient le **dossier de projets par défaut** : les nouveaux projets y sont créés et la page [Projets](/devforge/dev/projects/) le parcourt.

## 3. Tes comptes

- **Identité Git** : le nom et l'e-mail de tes commits (`git config --global`). S'ils existent déjà sur ce PC, ils sont préremplis.
- **GitHub** : si [GitHub CLI](https://cli.github.com) est déjà connecté (`gh auth login`), DevForge l'utilise et l'affiche. Sinon, tu peux coller un jeton personnel GitHub (facultatif).

Un serveur, Vercel, des bases de données ? Tu les brancheras quand tu veux dans [Paramètres › Connexions](/devforge/getting-started/connections/).

## 4. Voici Forgy

[Forgy](/devforge/forgy/assistant/) est l'assistant de DevForge. Il connaît tes projets et la page où tu es ; il lit, explique et peut agir pour toi, chaque action attendant ton accord.

Pour le faire parler, colle une **clé API Anthropic** (`sk-ant-…`) et clique sur **Enregistrer la clé**. C'est facultatif : sans clé, tout DevForge marche, sauf Forgy. La clé est chiffrée par Windows et ne sort que vers l'API Anthropic. **Plus tard** passe à l'étape suivante.

## 5. Tout est prêt

Trois repères pour la suite :

| Pour | Raccourci |
|---|---|
| Aller n'importe où, lancer une action | <kbd>Ctrl</kbd> <kbd>K</kbd> |
| Ouvrir Forgy | <kbd>Ctrl</kbd> <kbd>J</kbd> |
| Tout régler | **Paramètres**, en bas du menu |

**C'est parti** ouvre l'[accueil](/devforge/getting-started/interface/). L'écran de bienvenue ne revient plus, sauf après **Paramètres › Données › Tout effacer**.
