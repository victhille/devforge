import { launch } from './launch'

/**
 * Starts the built app once before the suite: on a fresh CI runner the first
 * Electron starts take 20 to 40 s (cold disk, antivirus), which ate the first
 * tests' time. Never fails the run: the tests report their own problems.
 */
export default async function warmup(): Promise<void> {
  try {
    const run = await launch()
    await run.close()
  } catch { /* the tests will say it */ }
}
