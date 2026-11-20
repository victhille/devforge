---
title: Vercel
description: Tous les projets Vercel du compte ou d'une équipe, leurs déploiements et les domaines, avec l'annulation d'un build, le passage en production et le lien vers un projet local.
---

La page **Vercel** (menu **Mise en ligne**) montre tout le compte Vercel, sans ouvrir le navigateur. L'onglet **Vercel** de la fiche d'un projet, lui, ne montre que le projet lié à son dossier (voir [Déploiement](/devforge/online/deploy/#vercel)).

Il faut un jeton Vercel, ajouté dans [Paramètres › Connexions](/devforge/getting-started/connections/#vercel) ou collé directement sur la page. En haut à droite, le menu **Compte ou équipe Vercel** passe du compte personnel à une de ses équipes, et **Actualiser** relit tout.

## Projets

Une carte par projet Vercel :

- son adresse de production, qui s'ouvre au clic ;
- son dernier déploiement : l'état (prêt, build, erreur…), la branche, quand, et le message du commit ;
- en bas, le projet DevForge dont le dossier est lié à lui (un clic ouvre sa fiche), ou **Lier à un projet local**.

**Lier à un projet local** propose les projets DevForge pas encore liés, celui qui porte le même nom en premier. DevForge écrit alors `.vercel/project.json` dans le dossier, comme `vercel link`, et ajoute `.vercel` au `.gitignore` s'il y en a un. Un dossier déjà lié à un autre projet Vercel n'est pas touché.

À droite, les **derniers déploiements, tous projets**.

## Déploiements

Les 40 derniers déploiements du compte ou de l'équipe, filtrés par **Tous**, **Production**, **Aperçus** ou **En échec**. Pour chacun :

- **Logs de build** ;
- **Annuler le build** tant qu'il est en file ou en cours (après confirmation) ;
- **Passer en production** pour un aperçu prêt (après confirmation) ;
- **Demander à Forgy** quand il a échoué : Forgy reçoit la fin du journal, secrets masqués, et cherche pourquoi ;
- l'icône ↗ ouvre le déploiement.

Un build en cours est suivi toutes les 5 secondes, tant que la fenêtre est visible.

## Domaines

Les domaines du compte ou de l'équipe : vérifiés ou non, DNS à corriger, achetés chez Vercel ou gérés ailleurs, et leur date d'expiration.

## Ce qui sort du PC

La page parle seulement à `api.vercel.com`, avec ton jeton. Elle ne lit aucune valeur de variable d'environnement. Les secrets reconnus (clés, jetons, mots de passe dans une URL) sont masqués dans les journaux de build.

**Demander à Forgy** envoie la fin du journal de build à ton fournisseur d'IA, seulement quand tu cliques (voir [ce que Forgy envoie](/devforge/privacy/#ce-que-forgy-envoie)).
