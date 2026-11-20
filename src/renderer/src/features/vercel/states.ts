import type { DotState } from '@renderer/components/ui/StatusDot'

/** A deployment's state as a pill (the project tab) */
export const STATE_TONE: Record<string, string> = {
  READY: 'bg-success-soft text-success',
  ERROR: 'bg-danger-soft text-danger',
  BUILDING: 'bg-warning-soft text-warning',
  QUEUED: 'bg-active text-fg-secondary',
  INITIALIZING: 'bg-warning-soft text-warning',
  CANCELED: 'bg-active text-fg-muted'
}

/** A deployment's state as a dot (the Vercel page) */
export const STATE_DOT: Record<string, DotState> = {
  READY: 'on',
  ERROR: 'error',
  BUILDING: 'warn',
  QUEUED: 'warn',
  INITIALIZING: 'warn',
  CANCELED: 'off'
}

/** Still building: it can be cancelled, and it is followed */
export const isBuilding = (state: string) => state === 'BUILDING' || state === 'QUEUED' || state === 'INITIALIZING'
