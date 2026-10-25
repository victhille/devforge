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
import { registerAutomationsHandlers } from './automations'
import { registerSetupHandlers } from './setup'
import { registerSymfonyHandlers } from './symfony'
import { registerLauncherHandlers } from './launcher'
import { registerVercelHandlers } from './vercel'
import { registerDictationHandlers } from './dictation'
import { registerDomainHandlers } from './domains'
import { registerDatabaseHandlers } from './database'
import { registerLogHandlers } from './logs'
import { registerWebhookHandlers } from './webhooks'
import { registerSuggestHandlers } from './suggest'
import { registerHttpHandlers } from './http'
import { registerAssistantHandlers } from './assistant'
import { registerWidgetHandlers } from './widget'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerSshHandlers(mainWindow)
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
  registerGithubHandlers()
  registerAutomationsHandlers()
  registerSetupHandlers()
  registerSymfonyHandlers(mainWindow)
  registerLauncherHandlers()
  registerVercelHandlers()
  registerDictationHandlers()
  registerDomainHandlers()
  registerDatabaseHandlers()
  registerLogHandlers(mainWindow)
  registerWebhookHandlers(mainWindow)
  registerSuggestHandlers()
  registerHttpHandlers()
  registerAssistantHandlers(mainWindow)
  registerWidgetHandlers()
}
