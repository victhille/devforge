# Signature de l'installeur

Tant que l'installeur n'est pas signé, Windows affiche « Windows a protégé votre ordinateur » (SmartScreen) à chaque nouvel utilisateur. En attendant :

- l'empreinte SHA-256 de l'installeur est affichée sous le bouton Télécharger du site (GitHub la calcule lui-même) et ajoutée aux notes de chaque version par `release.yml` ;
- la page Télécharger explique comment la comparer avec `Get-FileHash` ;
- les règles de signature sont publiées sur la page Vie privée du site (section « Signature du code »), comme SignPath le demande.

## Les options (état au 31/10/2026)

| Option | Coût | Pour un particulier en France |
|---|---|---|
| **SignPath Foundation** | gratuit pour l'open source | oui, sur dossier : accord au cas par cas |
| Azure Artifact Signing (ex-Trusted Signing) | environ 10 $/mois | **non** : les particuliers doivent être aux États-Unis ou au Canada |
| Certificat OV d'une autorité (Sectigo, Certum…) | environ 70 à 400 €/an, clé sur matériel ou HSM en ligne | oui |

Aucun certificat ne fait disparaître SmartScreen d'un coup : la réputation de l'éditeur se construit avec les téléchargements. Un installeur signé l'acquiert bien plus vite, et garde la même réputation d'une version à l'autre.

## SignPath Foundation : la marche à suivre

Conditions principales ([conditions officielles](https://signpath.org/terms.html)) :

- aucun composant propriétaire : DevForge est sous GPL-3.0 (licence open source reconnue) ;
- l'équipe qui signe est celle qui développe et possède le dépôt ;
- la **double authentification** activée sur GitHub et sur SignPath pour chaque membre ;
- une politique de signature publiée sur le site du projet : c'est fait ;
- des binaires construits depuis le code de façon vérifiable : c'est le cas avec `release.yml`.

SignPath tient aussi compte de la visibilité du projet (utilisateurs, mentions ailleurs) : postuler juste après le lancement public, avec quelques retours, donne plus de chances.

Étapes :

1. Vérifier que la double authentification est active sur le compte GitHub (Settings → Password and authentication).
2. Postuler sur [signpath.org](https://signpath.org) (« Apply ») avec le dépôt `victhille/devforge`.
3. Une fois accepté, SignPath fournit une organisation, un projet et une politique de signature. Il faudra alors :
   - ajouter le secret `SIGNPATH_API_TOKEN` au dépôt ;
   - signer l'installeur dans `release.yml` avec leur action GitHub, avant le calcul de `latest.yml` (la mise à jour automatique vérifie l'empreinte SHA-512 du fichier signé) ;
   - régler `publisherName` dans la config d'electron-builder, pour que les mises à jour vérifient la signature ;
   - ajouter la mention exigée sur la page Vie privée : « Signature gratuite fournie par SignPath.io, certificat de SignPath Foundation ».
