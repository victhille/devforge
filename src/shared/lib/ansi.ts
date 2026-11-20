/**
 * Terminal escape codes: colors and cursor moves (CSI), titles and links (OSC), charset
 * and keypad switches. Enough for a pseudo-terminal's output, not only for colors.
 */
// eslint-disable-next-line no-control-regex -- terminal escape codes are what this matches
export const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][\w]|\x1b[=>78]/g

export const stripAnsi = (text: string): string => text.replace(ANSI_RE, '')
