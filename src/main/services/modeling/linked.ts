import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadProjects } from '../projects/projectStorage'
import { driverFor } from '../database/dbClient'
import { projectDir } from './models'

/**
 * v3.9 lot 4: an MPD's catch-up script, run on its database (all or none where
 * the engine allows it), or handed to Doctrine as a migration in a Symfony project.
 */

export async function applyScript(connectionId: string, statements: string[]): Promise<{ ok: true } | { ok: false; error: string; index: number }> {
  const clean = statements.map(s => s.trim()).filter(s => s && !s.startsWith('--'))
  if (!clean.length) return { ok: true }
  try {
    await (await driverFor(connectionId)).transaction(clean.map(sql => ({ sql, params: [] })))
    return { ok: true }
  } catch (err) {
    const e = err as Error & { statementIndex?: number }
    return { ok: false, error: e.message, index: e.statementIndex ?? -1 }
  }
}

/** PHP's single-quoted string */
const php = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** The statements as a Doctrine migration (migrations/VersionYYYYMMDDHHMMSS.php); resolves with its path */
export function doctrineMigration(projectPath: string, statements: string[], description: string, now = new Date()): string {
  const dir = projectDir(projectPath)
  const project = loadProjects().find(p => p.path === dir)
  if (project?.framework !== 'symfony') throw new Error('Only a Symfony project has Doctrine migrations')
  const clean = statements.map(s => s.trim()).filter(s => s && !s.startsWith('--'))
  if (!clean.length) throw new Error('Nothing to migrate')
  const pad = (n: number) => String(n).padStart(2, '0')
  let stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const folder = join(dir, 'migrations')
  mkdirSync(folder, { recursive: true })
  while (existsSync(join(folder, `Version${stamp}.php`))) stamp = String(Number(stamp) + 1)
  const path = join(folder, `Version${stamp}.php`)
  writeFileSync(path, `<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\\DBAL\\Schema\\Schema;
use Doctrine\\Migrations\\AbstractMigration;

final class Version${stamp} extends AbstractMigration
{
    public function getDescription(): string
    {
        return ${php(description)};
    }

    public function up(Schema $schema): void
    {
${clean.map(s => `        $this->addSql(${php(s.replace(/;$/, ''))});`).join('\n')}
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException();
    }
}
`, 'utf-8')
  return path
}
