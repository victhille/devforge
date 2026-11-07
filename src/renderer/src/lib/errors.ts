/**
 * An error for the user: its message, without the "Error invoking remote
 * method '…': Error:" Electron puts before what the main process threw.
 */
export const errorText = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
