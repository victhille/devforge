import type { BrowserWindow } from 'electron'
import { registerSshHandlers } from './ssh'
import { registerSystemHandlers } from './system'
import { registerWindowHandlers } from './window'
import { registerProjectHandlers } from './projects'
import { registerSettingsHandlers } from './settings'
import { registerGitHandlers } from './git'
import { registerCleanerHandlers } from './cleaner'
import { registerEnvHandlers } from './envfiles'
import { registerStackHandlers } from './stacks'
import { registerDockerHandlers } from './docker'
import { registerDeployHandlers } from './deploy'
import { registerMonitorHandlers } from './monitor'
import { registerN8nHandlers } from './n8n'
import { registerVpnHandlers } from './vpn'
import { registerVpsOpsHandlers } from './vpsOps'
import { registerBackupsHandlers } from './backups'
import { registerGithubHandlers } from './github'
import { registerSetupHandlers } from './setup'
import { registerSymfonyHandlers } from './symfony'
import { registerLauncherHandlers } from './launcher'
import { registerStatusHandlers } from './status'
import { registerTerminalHandlers } from './terminal'
import { registerNextjsHandlers } from './nextjs'
import { registerLaravelHandlers } from './laravel'
import { registerConnectionsHandlers } from './connections'
import { registerPackagesHandlers } from './packages'
import { registerVercelHandlers } from './vercel'
import { registerDictationHandlers } from './dictation'
import { registerDomainHandlers } from './domains'
import { registerDatabaseHandlers } from './database'
import { registerTestsHandlers } from './tests'
import { registerNotesHandlers } from './notes'
import { registerTemplateHandlers } from './templates'
import { registerLogHandlers } from './logs'
import { registerWebhookHandlers } from './webhooks'
import { registerSuggestHandlers } from './suggest'
import { registerHttpHandlers } from './http'
import { registerAssistantHandlers } from './assistant'
import { registerWidgetHandlers } from './widget'
import { registerDocsHandlers } from './docs'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerSshHandlers(mainWindow)
  registerDocsHandlers()
  registerSystemHandlers(mainWindow)
  registerWindowHandlers(mainWindow)
  registerProjectHandlers(mainWindow)
  registerSettingsHandlers()
  registerGitHandlers()
  registerCleanerHandlers()
  registerEnvHandlers()
  registerStackHandlers(mainWindow)
  registerDockerHandlers()
  registerDeployHandlers(mainWindow)
  registerMonitorHandlers(mainWindow)
  registerN8nHandlers(mainWindow)
  registerVpnHandlers(mainWindow)
  registerVpsOpsHandlers(mainWindow)
  registerBackupsHandlers(mainWindow)
  registerGithubHandlers(mainWindow)
  registerSetupHandlers()
  registerSymfonyHandlers(mainWindow)
  registerLauncherHandlers()
  registerStatusHandlers(mainWindow)
  registerTerminalHandlers(mainWindow)
  registerNextjsHandlers(mainWindow)
  registerLaravelHandlers(mainWindow)
  registerConnectionsHandlers()
  registerPackagesHandlers(mainWindow)
  registerVercelHandlers()
  registerDictationHandlers()
  registerDomainHandlers()
  registerDatabaseHandlers(mainWindow)
  registerTestsHandlers(mainWindow)
  registerNotesHandlers()
  registerTemplateHandlers()
  registerLogHandlers(mainWindow)
  registerWebhookHandlers(mainWindow)
  registerSuggestHandlers()
  registerHttpHandlers()
  registerAssistantHandlers(mainWindow)
  registerWidgetHandlers()
}
