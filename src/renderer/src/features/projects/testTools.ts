import type { TestRunner } from '@shared/types'

/** The names of the test tools DevForge runs */
export const TEST_TOOL: Record<TestRunner, string> = { vitest: 'Vitest', jest: 'Jest', playwright: 'Playwright', phpunit: 'PHPUnit', pytest: 'pytest', go: 'Go', cargo: 'Cargo' }
