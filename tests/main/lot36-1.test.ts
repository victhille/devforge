import { describe, expect, it } from 'vitest'
import {
  backupFiles, cargoRange, fitsRangeOf, otherUpdateSteps, parseBundleAudit, parseCargoAudit, parseGovulncheck, parsePipAudit,
  pythonRange, reinstallCommand, rewriteVersion, rubyRange
} from '../../src/shared/lib/manifestUpdates'

/** v3.6 lot 1: updating and auditing Python, Rust, Go, Ruby and Dart packages */

describe('v3.6: each language\'s ranges', () => {
  it('reads PEP 440 specifiers', () => {
    expect(pythonRange('>=4.2,<5')).toBe('>=4.2 <5')
    expect(pythonRange('~=1.4')).toBe('>=1.4 <2.0.0')
    expect(pythonRange('~=1.4.2')).toBe('>=1.4.2 <1.5.0')
    expect(pythonRange('==2.31.0')).toBe('=2.31.0')
    expect(pythonRange('==1.2.*')).toBe('>=1.2 <1.3.0')
    expect(pythonRange('!=1.0,>=0.9')).toBe('>=0.9')
    expect(pythonRange('*')).toBe('*')
  })

  it('reads Cargo and Bundler requirements', () => {
    expect(cargoRange('1.2')).toBe('^1.2')
    expect(cargoRange('>=1.2, <1.5')).toBe('>=1.2 <1.5')
    expect(rubyRange('~> 7.1')).toBe('>=7.1 <8.0.0')
    expect(rubyRange('>= 6, < 8')).toBe('>=6 <8')
  })

  it('tells what stays within range, per manager', () => {
    expect(fitsRangeOf('pip', '4.2.11', '>=4.2,<5')).toBe(true)
    expect(fitsRangeOf('pip', '5.1.2', '>=4.2,<5')).toBe(false)
    expect(fitsRangeOf('pip', '2.32.3', '==2.31.0')).toBe(false)
    expect(fitsRangeOf('pip', '3.0.0', '*')).toBe(true)
    expect(fitsRangeOf('poetry', '5.0.3', '^5.0')).toBe(true)
    expect(fitsRangeOf('cargo', '1.36.0', '1.2')).toBe(true)
    expect(fitsRangeOf('cargo', '2.0.0', '1.2')).toBe(false)
    expect(fitsRangeOf('bundler', '7.2.0', '~> 7.1')).toBe(true)
    expect(fitsRangeOf('bundler', '8.0.0', '~> 7.1')).toBe(false)
    expect(fitsRangeOf('pub', '1.9.0', 'any')).toBe(true)
    expect(fitsRangeOf('go', '1.10.0', 'v1.9.1')).toBe(true)
  })
})

describe('v3.6: the steps of an update', () => {
  const both = [{ name: 'Django', dev: false, target: 'latest' as const }, { name: 'requests', dev: false, target: 'compatible' as const }]
  const latest = { Django: '5.1.2', requests: '2.32.3', pytest: '8.3.3' }

  it('pip: through the virtual environment, the range kept, the file rewritten for the latest', () => {
    expect(otherUpdateSteps('pip', 'requirements.txt', both, latest, { python: '.venv\\Scripts\\python.exe', wanted: { requests: '>=2.31,<3', Django: '>=4.2,<5' } })).toEqual([
      { rewrite: { name: 'Django', version: '5.1.2' } },
      { run: ['.venv\\Scripts\\python.exe', '-m', 'pip', 'install', '-U', 'requests>=2.31,<3', 'Django==5.1.2'] }
    ])
    // Never the system's Python
    expect(otherUpdateSteps('pip', 'requirements.txt', both, latest, {})).toEqual([])
  })

  it('Poetry, uv, Pipenv: their own commands, dev ones apart', () => {
    const dev = [...both, { name: 'pytest', dev: true, target: 'latest' as const }]
    expect(otherUpdateSteps('poetry', 'pyproject.toml', dev, latest)).toEqual([
      { run: ['poetry', 'update', 'requests'] },
      { run: ['poetry', 'add', 'Django@^5.1.2'] },
      { run: ['poetry', 'add', 'pytest@^8.3.3', '--group', 'dev'] }
    ])
    expect(otherUpdateSteps('uv', 'pyproject.toml', both, latest)).toEqual([
      { run: ['uv', 'lock', '--upgrade-package', 'requests'] },
      { run: ['uv', 'add', 'Django>=5.1.2'] },
      { run: ['uv', 'sync'] }
    ])
    expect(otherUpdateSteps('pipenv', 'Pipfile', both, latest)).toEqual([
      { run: ['pipenv', 'update', 'requests'] },
      { run: ['pipenv', 'install', 'Django>=5.1.2'] }
    ])
  })

  it('Cargo, Go, Bundler, pub', () => {
    const ups = [{ name: 'clap', dev: false, target: 'compatible' as const }, { name: 'tokio', dev: true, target: 'latest' as const }]
    expect(otherUpdateSteps('cargo', 'Cargo.toml', ups, { tokio: '1.40.0' })).toEqual([
      { run: ['cargo', 'update', '-p', 'clap'] },
      { run: ['cargo', 'add', 'tokio@1.40.0', '--dev'] }
    ])
    expect(otherUpdateSteps('go', 'go.mod', [{ name: 'github.com/gin-gonic/gin', dev: false, target: 'compatible' }], {})).toEqual([
      { run: ['go', 'get', 'github.com/gin-gonic/gin@latest'] },
      { run: ['go', 'mod', 'tidy'] }
    ])
    expect(otherUpdateSteps('bundler', 'Gemfile', [{ name: 'rails', dev: false, target: 'latest' }], { rails: '8.0.1' })).toEqual([
      { rewrite: { name: 'rails', version: '8.0.1' } },
      { run: ['bundle', 'update', 'rails'] }
    ])
    expect(otherUpdateSteps('pub', 'pubspec.yaml', [{ name: 'http', dev: false, target: 'latest' }, { name: 'lints', dev: true, target: 'latest' }], { http: '1.2.2', lints: '5.0.0' }, { flutter: true })).toEqual([
      { run: ['flutter', 'pub', 'add', 'http:^1.2.2', 'dev:lints:^5.0.0'] }
    ])
  })

  it('refuses names that could carry a command, and versions that are not plain', () => {
    expect(otherUpdateSteps('cargo', 'Cargo.toml', [{ name: 'x & del *', dev: false, target: 'compatible' }], {})).toEqual([])
    expect(otherUpdateSteps('cargo', 'Cargo.toml', [{ name: 'serde', dev: false, target: 'latest' }], { serde: '1.0 & calc' })).toEqual([])
  })

  it('saves the right files, and knows how to reinstall', () => {
    expect(backupFiles('pip', 'requirements-dev.txt')).toEqual(['requirements-dev.txt'])
    expect(backupFiles('go', 'go.mod')).toEqual(['go.mod', 'go.sum'])
    expect(reinstallCommand('pip', 'requirements.txt', '.venv\\Scripts\\python.exe')).toEqual(['.venv\\Scripts\\python.exe', '-m', 'pip', 'install', '-r', 'requirements.txt'])
    expect(reinstallCommand('pip', 'requirements.txt')).toBeNull()
    expect(reinstallCommand('bundler', 'Gemfile')).toEqual(['bundle', 'install'])
  })
})

describe('v3.6: a version rewritten in its file', () => {
  it('requirements.txt and pyproject.toml: the name as written, its extras and markers kept', () => {
    const req = '# web\nDjango>=4.2,<5  # LTS\ndjango-cors-headers==4.3.1\nrequests[socks]==2.31.0 ; python_version > "3.8"\n'
    expect(rewriteVersion('pip', req, 'django', '5.1.2')).toBe('# web\nDjango>=5.1.2  # LTS\ndjango-cors-headers==4.3.1\nrequests[socks]==2.31.0 ; python_version > "3.8"\n')
    expect(rewriteVersion('pip', req, 'requests', '2.32.3')).toContain('requests[socks]>=2.32.3 ; python_version > "3.8"')
    expect(rewriteVersion('pip', '[project]\ndependencies = [\n  "fastapi>=0.110",\n]\n', 'fastapi', '0.115.0')).toBe('[project]\ndependencies = [\n  "fastapi>=0.115.0",\n]\n')
  })

  it('Gemfile: the gem\'s versions become ~> major.minor', () => {
    expect(rewriteVersion('bundler', 'gem "rails", "~> 7.1"\ngem "pg"\n', 'rails', '8.0.1')).toBe('gem "rails", "~> 8.0"\ngem "pg"\n')
    expect(rewriteVersion('bundler', "gem 'pg'\n", 'pg', '1.5.9')).toBe("gem 'pg', \"~> 1.5\"\n")
  })
})

describe('v3.6: audit reports', () => {
  it('pip-audit (both formats)', () => {
    const r = parsePipAudit(JSON.stringify({ dependencies: [{ name: 'django', version: '4.2.0', vulns: [{ id: 'PYSEC-1' }, { id: 'GHSA-2' }] }, { name: 'idna', version: '3.7', vulns: [] }] }))
    expect(r).toMatchObject({ total: 2, packages: { django: 'unknown' } })
    expect(parsePipAudit('[]')).toMatchObject({ total: 0 })
    expect(parsePipAudit('not json')).toBeNull()
  })

  it('cargo audit, its CVSS score as severity', () => {
    const r = parseCargoAudit(JSON.stringify({ vulnerabilities: { found: true, count: 2, list: [
      { advisory: { id: 'RUSTSEC-1', cvss_score: 9.8 }, package: { name: 'openssl' } },
      { advisory: { id: 'RUSTSEC-2' }, package: { name: 'time' } }
    ] } }))
    expect(r).toMatchObject({ total: 2, packages: { openssl: 'critical', time: 'unknown' }, bySeverity: { critical: 1, unknown: 1 } })
  })

  it('govulncheck: only what the code calls, each finding once', () => {
    const stream = [
      JSON.stringify({ config: { protocol_version: 'v1.0.0' } }, null, 2),
      JSON.stringify({ finding: { osv: 'GO-2024-1', trace: [{ module: 'golang.org/x/net', function: 'Parse' }] } }, null, 2),
      JSON.stringify({ finding: { osv: 'GO-2024-1', trace: [{ module: 'golang.org/x/net', function: 'Parse' }, { module: 'example.com/api' }] } }, null, 2),
      JSON.stringify({ finding: { osv: 'GO-2024-2', trace: [{ module: 'golang.org/x/text' }] } }, null, 2)
    ].join('\n')
    expect(parseGovulncheck(stream)).toMatchObject({ total: 1, packages: { 'golang.org/x/net': 'unknown' } })
  })

  it('bundle-audit, its criticality', () => {
    expect(parseBundleAudit(JSON.stringify({ results: [{ type: 'unpatched_gem', gem: { name: 'rack' }, advisory: { criticality: 'high' } }, { gem: { name: 'nokogiri' }, advisory: { criticality: 'medium' } }] })))
      .toMatchObject({ total: 2, packages: { rack: 'high', nokogiri: 'moderate' } })
  })
})
