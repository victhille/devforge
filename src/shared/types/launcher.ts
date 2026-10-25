// ─── Global launcher (v2.2 lot 3) ─────────────────────────────────────────────

/** What the launcher asks the main window to do */
export type LauncherToMain =
  | { kind: 'navigate'; path: string }
  | { kind: 'script'; projectPath: string; script: string; pm: 'npm' | 'pnpm' | 'yarn'; name: string }
  | { kind: 'ask'; text: string }

export interface LauncherAPI {
  hide: () => Promise<void>
  /** Hands over to the main window, which comes to the front */
  toMain: (message: LauncherToMain) => Promise<void>
  /** The shortcut in use (null: off or taken by another application) */
  state: () => Promise<{ shortcut: string | null; taken: boolean }>
  /** The launcher window was just shown: reset and focus the input */
  onShown: (callback: () => void) => () => void
  /** Main window side */
  onToMain: (callback: (message: LauncherToMain) => void) => () => void
}
