import type { SfEntityDraft } from '@shared/types'

/** Window event: a draft arrived while the workshop is already open */
export const SF_DRAFT_EVENT = 'devforge:symfony-draft'

let pending: { projectPath: string; draft: SfEntityDraft } | null = null

/** Kept until the workshop of that project opens (it may not be on screen yet) */
export function setPendingDraft(projectPath: string, draft: SfEntityDraft): void {
  pending = { projectPath, draft }
  window.dispatchEvent(new Event(SF_DRAFT_EVENT))
}

/** The draft waiting for this project, taken once */
export function takePendingDraft(projectPath: string): SfEntityDraft | null {
  if (!pending || pending.projectPath !== projectPath) return null
  const { draft } = pending
  pending = null
  return draft
}
