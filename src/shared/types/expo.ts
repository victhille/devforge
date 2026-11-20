// ─── Expo: React Native projects, their Metro server and the QR code ─────────

/** A folder of a DevForge project that depends on `expo` (the project itself, or an app of its monorepo) */
export interface ExpoProject {
  /** `<project id>` or `<project id>/<folder under it>` */
  id: string
  projectId: string
  name: string
  /** Project name, then the folder under it when the app is in a monorepo */
  label: string
  /** Major version of the `expo` package: 54 for ~54.0.0 */
  sdk: number | null
  router: boolean
  /** `expo-dev-client` is installed: a development build can open it */
  devClient: boolean
}

/** Expo Go, or a development build installed on the phone */
export type ExpoTarget = 'go' | 'dev'
/** Same Wi-Fi, a tunnel through Expo's service, or this PC only (an emulator, the browser) */
export type ExpoConnection = 'lan' | 'tunnel' | 'localhost'

export interface ExpoStartOptions {
  target: ExpoTarget
  connection: ExpoConnection
  port: number
  clear: boolean
}

export interface ExpoStatus {
  /** The app being served, null when none */
  id: string | null
  state: 'stopped' | 'starting' | 'running' | 'failed'
  port: number | null
  /** What the QR code holds: exp://… or the development build's link */
  url: string | null
  options: ExpoStartOptions | null
  /** Expo asks to install @expo/ngrok for the tunnel */
  needsNgrok: boolean
}

export interface ExpoLog {
  id: string
  stream: 'out' | 'system'
  text: string
}

/** `expo install --check`: packages whose version does not follow the SDK */
export interface ExpoCheck {
  ok: boolean
  /** name, installed version, the one expected */
  packages: { name: string; installed: string; expected: string }[]
  /** The command's output, when it could not be read as a list */
  output: string
}

/** Keys of Expo's terminal UI that the page sends: Android, web, reload, dev menu, devtools, switch Go / build */
export type ExpoKey = 'a' | 'w' | 'r' | 'm' | 'j' | 's'

export interface ExpoAPI {
  projects: () => Promise<ExpoProject[]>
  status: () => Promise<ExpoStatus>
  logs: () => Promise<ExpoLog[]>
  start: (id: string, options: ExpoStartOptions) => Promise<ExpoStatus>
  stop: () => Promise<ExpoStatus>
  key: (key: ExpoKey) => Promise<void>
  /** Answers yes to Expo's question to install @expo/ngrok */
  installNgrok: () => Promise<void>
  check: (id: string) => Promise<ExpoCheck>
  /** `expo install --fix`: aligns the packages on the SDK */
  fix: (id: string) => Promise<ExpoCheck>
  onLog: (cb: (log: ExpoLog) => void) => () => void
  onStatus: (cb: (status: ExpoStatus) => void) => () => void
}
