import { platform } from 'os'

export type Platform = 'win32' | 'darwin' | 'linux'

export function currentPlatform(): Platform {
  return platform() as Platform
}

export function isWindows(): boolean {
  return platform() === 'win32'
}

export function isMac(): boolean {
  return platform() === 'darwin'
}

export function isLinux(): boolean {
  return platform() === 'linux'
}

/** Normalize a path separator for the current platform (informational only — use Node path module for real work). */
export function getShell(): string {
  if (isWindows()) return 'powershell.exe'
  if (isMac()) return '/bin/zsh'
  return '/bin/bash'
}

/** Returns the command to open a directory in the OS file explorer. */
export function getOpenFolderCommand(): string {
  if (isWindows()) return 'explorer'
  if (isMac()) return 'open'
  return 'xdg-open'
}
