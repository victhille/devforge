---
title: Forgy sur le bureau et dictée
description: La bulle de Forgy toujours au premier plan, accessible de n'importe quelle application, et la dictée vocale qui tourne sur ton PC.
---

## Forgy sur le bureau

**Paramètres › Forgy › Forgy sur le bureau** (désactivé par défaut) affiche une bulle toujours au premier plan, en bas à droite de l'écran principal, au-dessus de l'horloge, même quand DevForge est dans la barre des tâches.

- **Ouvrir** : clic sur la bulle, ou <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>Espace</kbd> depuis n'importe quelle application. Si ce raccourci est déjà pris (par le [lanceur global](/devforge/getting-started/interface/#le-lanceur-global) ou une autre application), c'est <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>J</kbd>. Le raccourci actif est affiché sous l'interrupteur.
- **Demander** : une ligne, <kbd>Entrée</kbd>. La réponse s'affiche au-dessus, avec **Copier** et **Ouvrir dans DevForge** (la conversation continue dans le panneau).
- **Pastilles** : si la bulle est repliée pendant une réponse, une pastille orange signale son arrivée, rouge en cas d'erreur.
- **Puces** : la profondeur de réflexion (fixée pour la conversation) et le projet en contexte.
- **Replier** : le chevron, <kbd>Échap</kbd> ou le raccourci. Replier après une réponse démarre une nouvelle conversation.

C'est le même assistant que le panneau : même clé, même budget, même historique. Repliée, la bulle ne prend jamais le focus et rien n'y bouge.

## Dictée

Le bouton micro du panneau et de la bulle permet de **parler** au lieu de taper : clic pour commencer, clic pour finir (60 secondes au plus). Le texte s'ajoute au champ.

La reconnaissance (Whisper) **tourne sur ton PC** : ta voix ne quitte pas l'ordinateur et aucun compte n'est nécessaire.

| Modèle | Taille | Pour |
|---|---|---|
| Rapide | environ 75 Mo | l'usage courant |
| Précise | environ 250 Mo | meilleure sur les mots techniques |

Le modèle se choisit dans **Paramètres › Forgy › Dictée**. Il se télécharge une fois, à la première dictée ou avec **Télécharger maintenant**, puis tout marche hors ligne. **Supprimer le modèle** libère la place. La langue est celle de l'interface.

Si le micro est refusé : **Paramètres Windows › Confidentialité › Microphone**.
