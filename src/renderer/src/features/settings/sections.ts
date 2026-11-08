import { Bot, Database, Info, LayoutTemplate, Palette, Plug, RefreshCw, Server, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { PROVIDERS } from '@shared/data/assistantProviders'

export type SettingsSection = 'general' | 'templates' | 'connections' | 'appearance' | 'forgy' | 'servers' | 'data' | 'updates' | 'about'

/** The sections of the Settings, in the menu's panel and the page; `words` are what the search also finds */
export const SETTINGS_SECTIONS: { id: SettingsSection; icon: LucideIcon; words: string }[] = [
  { id: 'general', icon: SlidersHorizontal, words: 'dossier folder projets projects paquets package npm pnpm yarn éditeur editor ide vs code windows démarrer start barre tray lanceur launcher raccourci shortcut raycast' },
  { id: 'templates', icon: LayoutTemplate, words: 'modèles templates projet project copier copy nouveau new' },
  { id: 'connections', icon: Plug, words: 'connexions connections comptes accounts github gh jeton token git identité identity nom e-mail clé key anthropic vercel docker serveur server vps ssh base database' },
  { id: 'appearance', icon: Palette, words: 'thème theme sombre dark clair light langue language anglais english français animations motion densité density compact compacte' },
  { id: 'forgy', icon: Bot, words: `assistant clé key api modèle model effort budget actions widget raccourci shortcut promène walk boulon fournisseur provider gpt ${PROVIDERS.map(p => p.label).join(' ')}` },
  { id: 'servers', icon: Server, words: 'surveillance watch vps ssh alertes alerts disque disk conteneur container notifications site' },
  { id: 'data', icon: Database, words: 'données data sauvegardes backups restaurer restore journal log diagnostic rapport report dossier effacer clear historique history' },
  { id: 'updates', icon: RefreshCw, words: 'mise à jour update version bêta beta canal channel nouveautés notes quoi de neuf what new' },
  { id: 'about', icon: Info, words: 'version commit github licences problème issue' }
]
