import { useSshConnections } from '@renderer/hooks/useLiveData'

/** Whether at least one server is set up; follows additions and removals */
export function useHasServer(): boolean {
  return (useSshConnections().data?.length ?? 0) > 0
}

/** The name of the first server set up, null without one; follows additions, renames and removals */
export function useServerName(): string | null {
  return useSshConnections().data?.[0]?.name || null
}
