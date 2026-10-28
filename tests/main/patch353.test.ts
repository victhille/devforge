import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseToml } from '../../src/shared/lib/tomlLite'
import { codeLanguage } from '../../src/shared/lib/codeLanguage'
import {
  distInfo, gemfileLockVersions, parseCargo, parseCsproj, parseGemfile, parseGoMod, parseGradle, parsePipfile, parsePom,
  parsePubspec, parsePyproject, parseRequirements, pipfileLockVersions, pubspecLockVersions, tomlLockVersions
} from '../../src/shared/lib/manifests'
import { listOtherManifests, registryOf } from '../../src/main/services/packages/otherPackages'
import { tempDir } from '../helpers'

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const names = (deps: { name: string; wanted: string; dev: boolean }[]) => deps.map(d => `${d.name} ${d.wanted}${d.dev ? ' dev' : ''}`)

describe('v3.5.3: TOML, just enough', () => {
  it('reads tables, dotted keys, multi-line arrays, inline tables and arrays of tables', () => {
    const doc = parseToml([
      'name = "app" # a comment',
      '[project]',
      'dependencies = [',
      '  "fastapi>=0.110", # web',
      "  'uvicorn[standard]',",
      ']',
      '[tool.poetry.dependencies]',
      'python = "^3.12"',
      'django = { version = "^5.0", extras = ["argon2"] }',
      'serde.workspace = true',
      '[[package]]',
      'name = "a"',
      'version = "1.0.0"',
      '[[package]]',
      'name = "b"',
      'version = "2.0.0"'
    ].join('\r\n'))
    expect(doc.tables[''].name).toBe('app')
    expect(doc.tables.project.dependencies).toEqual(['fastapi>=0.110', 'uvicorn[standard]'])
    expect(doc.tables['tool.poetry.dependencies'].django).toEqual({ version: '^5.0', extras: ['argon2'] })
    expect(doc.tables['tool.poetry.dependencies'].serde).toEqual({ workspace: true })
    expect(doc.arrays.package.map(p => p.name)).toEqual(['a', 'b'])
  })
})

describe('v3.5.3: Python', () => {
  it('reads requirements.txt, skipping options and URLs', () => {
    expect(names(parseRequirements([
      '# web', 'Django>=5.0,<6  # pinned below 6', 'requests[socks] == 2.31.0', '-r base.txt', '-e .',
      'https://example.invalid/pkg.whl', "pywin32>=306; sys_platform == 'win32'", 'gunicorn'
    ].join('\n')))).toEqual(['Django >=5.0,<6', 'requests ==2.31.0', 'pywin32 >=306', 'gunicorn *'])
  })

  it('reads pyproject.toml: PEP 621 with its groups, and Poetry', () => {
    const pep = parsePyproject('[project]\nname = "api"\ndependencies = ["fastapi>=0.110"]\n[project.optional-dependencies]\ntest = ["pytest>=8"]\n[dependency-groups]\ndev = ["ruff"]\n')
    expect(pep.poetry).toBe(false)
    expect(names(pep.deps)).toEqual(['fastapi >=0.110', 'pytest >=8 dev', 'ruff * dev'])
    const poetry = parsePyproject('[tool.poetry]\nname = "x"\n[tool.poetry.dependencies]\npython = "^3.12"\ndjango = "^5.0"\n[tool.poetry.group.dev.dependencies]\npytest = { version = "^8.0" }\n')
    expect(poetry.poetry).toBe(true)
    expect(names(poetry.deps)).toEqual(['django ^5.0', 'pytest ^8.0 dev'])
  })

  it('reads a Pipfile, and versions from the locks and the virtual environment', () => {
    expect(names(parsePipfile('[packages]\nflask = "*"\nrequests = { version = ">=2.31" }\n[dev-packages]\npytest = "*"\n'))).toEqual(['flask *', 'requests >=2.31', 'pytest * dev'])
    expect(pipfileLockVersions(JSON.stringify({ default: { Flask: { version: '==3.0.2' } }, develop: { pytest: { version: '==8.1.1' } } }))).toEqual({ flask: '3.0.2', pytest: '8.1.1' })
    expect(tomlLockVersions('[[package]]\nname = "Django"\nversion = "5.0.3"\n', n => n.toLowerCase())).toEqual({ django: '5.0.3' })
    expect(distInfo('typing_extensions-4.10.0.dist-info')).toEqual(['typing-extensions', '4.10.0'])
    expect(distInfo('pip')).toBeNull()
  })
})

describe('v3.5.3: Rust, Go, Ruby, Dart, .NET, Java', () => {
  it('reads Cargo.toml with its tables', () => {
    expect(names(parseCargo('[package]\nname = "cli"\n[dependencies]\nserde = { version = "1.0", features = ["derive"] }\nclap = "4.5"\nlocal = { path = "../local" }\n[dependencies.tokio]\nversion = "1.36"\n[dev-dependencies]\ninsta = "1"\n')))
      .toEqual(['serde 1.0', 'clap 4.5', 'local *', 'tokio 1.36', 'insta 1 dev'])
  })

  it('reads go.mod, direct modules only', () => {
    expect(names(parseGoMod('module example.com/api\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgolang.org/x/net v0.22.0 // indirect\n)\n\nrequire github.com/google/uuid v1.6.0\n')))
      .toEqual(['github.com/gin-gonic/gin v1.9.1', 'github.com/google/uuid v1.6.0'])
  })

  it('reads a Gemfile with its groups, and Gemfile.lock', () => {
    expect(names(parseGemfile('source "https://rubygems.org"\ngem "rails", "~> 7.1"\ngem "pg"\ngroup :development, :test do\n  gem "rspec-rails", ">= 6", "< 8"\nend\ngem "puma"\n')))
      .toEqual(['rails ~> 7.1', 'pg *', 'rspec-rails >= 6, < 8 dev', 'puma *'])
    expect(gemfileLockVersions('GEM\n  specs:\n    rails (7.1.3)\n      actionpack (= 7.1.3)\n    nokogiri (1.16.2-x64-mingw-ucrt)\n')).toEqual({ rails: '7.1.3', nokogiri: '1.16.2' })
  })

  it('reads pubspec.yaml without the SDK, and pubspec.lock', () => {
    expect(names(parsePubspec('name: app\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\n  intl:\n    version: ^0.19.0\ndev_dependencies:\n  flutter_lints: ^3.0.0\nflutter:\n  uses-material-design: true\n')))
      .toEqual(['http ^1.2.0', 'intl ^0.19.0', 'flutter_lints ^3.0.0 dev'])
    expect(pubspecLockVersions('packages:\n  http:\n    dependency: "direct main"\n    version: "1.2.1"\n')).toEqual({ http: '1.2.1' })
  })

  it('reads .csproj, pom.xml (with its properties) and build.gradle', () => {
    expect(names(parseCsproj('<ItemGroup>\n<PackageReference Include="Serilog" Version="3.1.1" />\n<PackageReference Include="Dapper">\n  <Version>2.1.28</Version>\n</PackageReference>\n</ItemGroup>')))
      .toEqual(['Serilog 3.1.1', 'Dapper 2.1.28'])
    expect(names(parsePom('<project><properties><spring.version>6.1.4</spring.version></properties><dependencies>'
      + '<dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId><version>${spring.version}</version></dependency>'
      + '<dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><version>5.10.2</version><scope>test</scope></dependency>'
      + '</dependencies></project>'))).toEqual(['org.springframework:spring-core 6.1.4', 'org.junit.jupiter:junit-jupiter 5.10.2 dev'])
    expect(names(parseGradle('dependencies {\n  implementation("com.squareup.okhttp3:okhttp:4.12.0")\n  testImplementation \'junit:junit:4.13.2\'\n  id("org.jetbrains.kotlin.jvm")\n}\n')))
      .toEqual(['com.squareup.okhttp3:okhttp 4.12.0', 'junit:junit 4.13.2 dev'])
  })
})

describe('v3.5.3: a project\'s other packages', () => {
  it('finds each file, with what its lockfile or virtual environment holds; never inside a venv', () => {
    const root = tempDir('pkgs')
    file(join(root, 'api', 'requirements.txt'), 'Django>=5.0\nrequests\n')
    file(join(root, 'api', '.venv', 'pyvenv.cfg'), 'home = C:\\Python312\n')
    mkdirSync(join(root, 'api', '.venv', 'Lib', 'site-packages', 'Django-5.0.3.dist-info'), { recursive: true })
    file(join(root, 'api', 'venv', 'lib', 'requirements.txt'), 'ignored\n')
    file(join(root, 'cli', 'Cargo.toml'), '[package]\nname = "cli"\n[dependencies]\nclap = "4.5"\n')
    file(join(root, 'cli', 'Cargo.lock'), '[[package]]\nname = "clap"\nversion = "4.5.2"\n')
    file(join(root, 'tools', 'pyproject.toml'), '[tool.ruff]\nline-length = 100\n')

    const found = listOtherManifests(root)
    expect(found.map(m => `${m.dir}/${m.file} ${m.manager}`)).toEqual(['api/requirements.txt pip', 'cli/Cargo.toml cargo'])
    expect(found[0].packages).toEqual([
      { name: 'Django', wanted: '>=5.0', dev: false, installed: '5.0.3' },
      { name: 'requests', wanted: '*', dev: false, installed: null }
    ])
    expect(found[1]).toMatchObject({ name: 'cli', readOnly: true, packages: [{ name: 'clap', installed: '4.5.2' }] })
  })

  it('knows each file\'s registry', () => {
    expect(['requirements-dev.txt', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'App.csproj', 'build.gradle.kts', 'package.json'].map(registryOf))
      .toEqual(['pip', 'pip', 'cargo', 'go', 'nuget', 'gradle', null])
  })
})

describe('v3.5.3: code colours', () => {
  it('picks the grammar from the name', () => {
    expect(['ComingSoon.vue', 'main.ts', 'Dockerfile', 'Dockerfile.dev', '.env.local', 'compose.yaml', 'app.py', 'yarn.lock', 'LICENSE', 'Gemfile'].map(codeLanguage))
      .toEqual(['xml', 'typescript', 'dockerfile', 'dockerfile', 'properties', 'yaml', 'python', null, null, 'ruby'])
  })
})
