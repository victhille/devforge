// ─── Automations: the feed of the n8n automations, read from Automations's own cache ───

export type AutomationsGravity = 'info' | 'attention' | 'urgent'

export interface AutomationsItem {
  uid: string
  type: string
  titre: string
  gravite: AutomationsGravity
  lu: boolean
  /** When it happens, ISO */
  date: string
}

/** One automation of Automations and what it published last */
export interface AutomationsAutomation {
  /** 'briefing', 'mail', 'deals'… */
  key: string
  types: string[]
  last: AutomationsItem | null
  unread: number
}

export interface AutomationsFeed {
  /** The cache file exists */
  found: boolean
  /** Automations is installed (it can be opened) */
  installed: boolean
  automations: AutomationsAutomation[]
  /** Unread items, newest first (at most 20) */
  unread: AutomationsItem[]
  /** Last change seen in the cache, ISO */
  updatedAt: string | null
}

export interface AutomationsAPI {
  feed: () => Promise<AutomationsFeed>
  /** Starts Automations, or brings it to the front */
  open: () => Promise<void>
}
