import type { SfEntity, SfField, SfFieldType, SfMigration, SfRelation, SfRoute } from '@shared/types'

/**
 * Boots the project's kernel and prints what Doctrine knows, as JSON between
 * markers (deprecation notices may come before). Run as `php script <project>`.
 */
export const INSPECT_PHP = String.raw`<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');
$dir = $argv[1];
chdir($dir);
$out = ['booted' => false, 'error' => null, 'version' => null, 'entities' => [], 'db' => null, 'executed' => []];
try {
    require $dir . '/vendor/autoload.php';
    if (class_exists('Symfony\Component\Dotenv\Dotenv')) {
        (new Symfony\Component\Dotenv\Dotenv())->bootEnv($dir . '/.env');
    }
    $kernel = new App\Kernel($_SERVER['APP_ENV'] ?? 'dev', (bool) ($_SERVER['APP_DEBUG'] ?? true));
    $kernel->boot();
    $out['booted'] = true;
    $out['version'] = Symfony\Component\HttpKernel\Kernel::VERSION;
    $c = $kernel->getContainer();
    if ($c->has('doctrine')) {
        $doctrine = $c->get('doctrine');
        $em = $doctrine->getManager();
        foreach ($em->getMetadataFactory()->getAllMetadata() as $m) {
            $class = $m->getName();
            if (strpos($class, 'App\\Entity\\') !== 0) continue;
            $ref = new ReflectionClass($class);
            $fields = [];
            foreach ($m->getFieldNames() as $f) {
                if (in_array($f, $m->getIdentifierFieldNames(), true)) continue;
                $map = $m->getFieldMapping($f);
                $fields[] = [
                    'name' => $f, 'type' => $map['type'] ?? 'string',
                    'nullable' => (bool) ($map['nullable'] ?? false), 'unique' => (bool) ($map['unique'] ?? false),
                    'length' => $map['length'] ?? null, 'precision' => $map['precision'] ?? null, 'scale' => $map['scale'] ?? null,
                ];
            }
            $relations = [];
            foreach ($m->getAssociationMappings() as $name => $a) {
                $type = is_object($a) && method_exists($a, 'type') ? $a->type() : $a['type'];
                $kind = [1 => 'OneToOne', 2 => 'ManyToOne', 4 => 'OneToMany', 8 => 'ManyToMany'][$type] ?? 'ManyToOne';
                $nullable = true;
                try {
                    $jc = $a['joinColumns'] ?? [];
                    if (!empty($jc)) { $nullable = (bool) ($jc[0]['nullable'] ?? true); }
                } catch (Throwable $e) {}
                $target = $a['targetEntity'];
                $relations[] = [
                    'name' => $name, 'kind' => $kind, 'target' => substr($target, strrpos($target, '\\') + 1),
                    'inverse' => $a['inversedBy'] ?? $a['mappedBy'] ?? null, 'nullable' => $nullable,
                ];
            }
            $out['entities'][] = [
                'name' => $ref->getShortName(), 'table' => $m->getTableName(), 'file' => $ref->getFileName(),
                'fields' => $fields, 'relations' => $relations,
                'apiResource' => count($ref->getAttributes('ApiPlatform\Metadata\ApiResource')) > 0,
            ];
        }
        $conn = $doctrine->getConnection();
        $p = $conn->getParams();
        $driver = $p['driver'] ?? (isset($p['driverClass']) ? $p['driverClass'] : '');
        $target = isset($p['path']) ? $p['path'] : (($p['host'] ?? '') . (isset($p['port']) ? ':' . $p['port'] : '') . '/' . ($p['dbname'] ?? ''));
        $db = ['configured' => true, 'driver' => (string) $driver, 'target' => $target, 'reachable' => false, 'error' => null];
        try {
            $conn->executeQuery('SELECT 1');
            $db['reachable'] = true;
            try {
                foreach ($conn->fetchAllAssociative('SELECT version, executed_at FROM doctrine_migration_versions') as $row) {
                    $out['executed'][] = ['version' => $row['version'], 'at' => $row['executed_at']];
                }
            } catch (Throwable $e) {}
        } catch (Throwable $e) {
            $db['error'] = $e->getMessage();
        }
        $out['db'] = $db;
    }
} catch (Throwable $e) {
    $out['error'] = $e->getMessage();
}
echo "\n@@DEVFORGE@@" . json_encode($out) . "@@DEVFORGE@@\n";
`

export interface RawInspect {
  booted: boolean
  error: string | null
  version: string | null
  entities: (Omit<SfEntity, 'fields'> & { fields: (Omit<SfField, 'type'> & { type: string; length: number | null; precision: number | null; scale: number | null })[] })[]
  db: { configured: boolean; driver: string; target: string; reachable: boolean; error: string | null } | null
  executed: { version: string; at: string | null }[]
}

export function parseInspect(stdout: string): RawInspect | null {
  const m = stdout.match(/@@DEVFORGE@@([\s\S]*)@@DEVFORGE@@/)
  if (!m) return null
  try { return JSON.parse(m[1]) as RawInspect } catch { return null }
}

/** Doctrine type → the workshop's field types */
const TYPE_OF: Record<string, SfFieldType> = {
  string: 'string', ascii_string: 'string', guid: 'string', text: 'text', integer: 'integer', smallint: 'integer', bigint: 'integer',
  float: 'float', decimal: 'decimal', boolean: 'boolean', date: 'date', date_immutable: 'date', datetime: 'datetime',
  datetime_immutable: 'datetime', datetimetz: 'datetime', datetimetz_immutable: 'datetime', json: 'json', simple_array: 'json'
}

/** Entities as the workshop shows them; paths relative to the project */
export function toEntities(raw: RawInspect, projectPath: string): SfEntity[] {
  const root = projectPath.replace(/[\\/]+$/, '').toLowerCase().replace(/\\/g, '/')
  return raw.entities.map(e => ({
    name: e.name, table: e.table, apiResource: e.apiResource,
    file: (() => { const f = e.file.replace(/\\/g, '/'); return f.toLowerCase().startsWith(root + '/') ? f.slice(root.length + 1) : f })(),
    fields: e.fields.map(f => ({
      name: f.name, type: TYPE_OF[f.type] ?? 'string', nullable: f.nullable, unique: f.unique,
      ...(f.length ? { length: f.length } : {}), ...(f.precision ? { precision: f.precision, scale: f.scale ?? 0 } : {})
    })),
    relations: e.relations as SfRelation[]
  })).sort((a, b) => a.name.localeCompare(b.name))
}

/** The SQL of up() in a Doctrine migration file */
export function migrationSql(php: string): string[] {
  const up = php.match(/function up\([^)]*\)[^{]*\{([\s\S]*?)\r?\n {4}\}/)
  if (!up) return []
  return [...up[1].matchAll(/addSql\(\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
}

export const migrationDescription = (php: string) => php.match(/function getDescription\(\)[^{]*\{\s*return\s+'((?:[^'\\]|\\.)*)'/)?.[1].replace(/\\'/g, "'") ?? ''

export const isDangerous = (sql: string[]) => sql.some(s => /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(s))

/** Files of migrations/ and what the database says ran, newest first */
export function toMigrations(files: { name: string; php: string }[], executed: { version: string; at: string | null }[]): SfMigration[] {
  const ran = new Map(executed.map(e => [e.version, e.at]))
  const list: SfMigration[] = files.filter(f => /^Version\w+\.php$/.test(f.name)).map(f => {
    const version = `DoctrineMigrations\\${f.name.replace(/\.php$/, '')}`
    const sql = migrationSql(f.php)
    return { version, description: migrationDescription(f.php), executed: ran.has(version), executedAt: ran.get(version) ?? null, file: `migrations/${f.name}`, sql, dangerous: isDangerous(sql) }
  })
  for (const e of executed) {
    if (!list.some(m => m.version === e.version)) list.push({ version: e.version, description: '', executed: true, executedAt: e.at, file: null, sql: [], dangerous: false })
  }
  return list.sort((a, b) => b.version.localeCompare(a.version))
}

/** Symfony's and API Platform's own tool routes; API Platform's resource routes (_api_/…) stay */
const TOOL_ROUTE = /^(_profiler|_wdt|_preview_error|_api_errors|_api_validation_errors|api_genid|api_validation_errors|api_jsonld_context)/

/** `debug:router --format=json`, without the tool routes; ".{_format}" dropped from paths */
export function parseRoutes(json: string): SfRoute[] {
  const start = json.indexOf('{')
  if (start < 0) return []
  const data = JSON.parse(json.slice(start)) as Record<string, { path: string; method: string; defaults?: { _controller?: string } }>
  return Object.entries(data)
    .filter(([name]) => !TOOL_ROUTE.test(name))
    .map(([name, r]) => ({
      name, path: r.path.replace(/\.\{_format\}$/, ''),
      methods: r.method === 'ANY' || !r.method ? [] : r.method.split('|').filter(m => m !== 'HEAD'),
      controller: r.defaults?._controller ?? ''
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}
