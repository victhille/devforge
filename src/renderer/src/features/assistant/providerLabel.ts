import type { AssistantProvider } from '@shared/types'
import { providerInfo } from '@shared/data/assistantProviders'
import type { Translations } from '@renderer/i18n/translations'

/** v4.2: a provider's name as the interface shows it: a brand stays as it is, « OpenAI-compatible » is said in the user's language */
export const providerLabel = (p: AssistantProvider, t: Translations): string => (p === 'custom' ? t.assistant.customProvider : providerInfo(p).label)
