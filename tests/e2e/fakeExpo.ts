import { writeFileSync } from 'fs'
import { join } from 'path'

/**
 * A stand-in for `npx expo …`, run by DevForge in its pseudo-terminal (DEVFORGE_TEST_EXPO_CMD):
 * `start` prints Metro's lines and the exp:// address, then answers the keys it gets;
 * `install --check` lists one package off the SDK until `install --fix` has run.
 */
const FAKE_EXPO = `
const fs = require('fs')
const args = process.argv.slice(2)
if (args[0] === 'expo' && args[1] === 'install') {
  if (args.includes('--fix')) {
    fs.writeFileSync('.fixed', '')
    console.log('Fixed 1 package')
    process.exit(0)
  }
  if (fs.existsSync('.fixed')) {
    console.log('Dependencies are up to date')
    process.exit(0)
  }
  console.log('The following packages should be updated for best compatibility with the installed expo version:')
  console.log('  react-native-reanimated@3.10.1 - expected version: ~3.16.1')
  process.exit(1)
}
const port = args[args.indexOf('--port') + 1]
console.log('\\x1b[2KStarting Metro Bundler')
setTimeout(() => console.log('\\u203a Metro waiting on exp://192.168.1.71:' + port), 300)
setTimeout(() => console.log('ERROR  TypeError: undefined is not an object (evaluating invoice.total)'), 600)
process.stdin.setRawMode && process.stdin.setRawMode(true)
process.stdin.on('data', d => {
  const k = String(d)
  console.log(k === 'r' ? '\\u203a Reloading apps' : '\\u203a Pressed ' + k)
})
setInterval(() => {}, 1000)
`

export function writeFakeExpo(dir: string): string {
  const file = join(dir, 'fake-expo.cjs')
  writeFileSync(file, FAKE_EXPO)
  return file
}
