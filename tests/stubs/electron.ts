// Minimal Electron surface used by main-process services under test
export const app = {
  getPath: () => process.env.DEVFORGE_TEST_USERDATA!,
  getVersion: () => '0.0.0-test',
  isPackaged: false
}

/** Reversible fake: lets tests check that secrets are not stored in clear */
export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from('ENC:' + Buffer.from(s).toString('base64')),
  decryptString: (b: Buffer) => Buffer.from(b.toString().slice(4), 'base64').toString()
}

export const shell = { openPath: async () => '', openExternal: async () => {} }
export const ipcMain = { handle: () => {}, on: () => {} }
export const BrowserWindow = { getAllWindows: () => [] }
