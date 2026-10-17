import { readdirSync, existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import type { DetectedProject, Framework, PackageManager } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileExists(dir: string, ...parts: string[]): boolean {
  return existsSync(join(dir, ...parts))
}

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return {} }
}

function hasDep(pkg: Record<string, unknown>, ...names: string[]): boolean {
  const deps = {
    ...(pkg.dependencies    as Record<string, unknown> ?? {}),
    ...(pkg.devDependencies as Record<string, unknown> ?? {})
  }
  return names.some(n => n in deps)
}

function listDir(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

function hasExtension(dir: string, ...exts: string[]): boolean {
  return listDir(dir).some(f => exts.some(e => f.endsWith(e)))
}

// ─── Package manager ──────────────────────────────────────────────────────────

function detectPackageManager(dir: string): PackageManager {
  if (fileExists(dir, 'pnpm-lock.yaml')) return 'pnpm'
  if (fileExists(dir, 'yarn.lock'))       return 'yarn'
  return 'npm'
}

// ─── Framework detection ──────────────────────────────────────────────────────

function detectFramework(dir: string): Framework {
  const files = listDir(dir)

  // ── JavaScript / TypeScript ──────────────────────────────────────────────
  if (fileExists(dir, 'package.json')) {
    const pkg = readJson(join(dir, 'package.json'))
    if (hasDep(pkg, 'next'))             return 'nextjs'
    if (hasDep(pkg, 'react', 'react-dom')) return 'react'
    if (hasDep(pkg, 'vue'))              return 'vue'
    if (hasDep(pkg, '@angular/core'))    return 'angular'
    if (hasDep(pkg, 'svelte'))           return 'svelte'
    if (hasDep(pkg, 'express'))          return 'express'
    return 'nodejs'
  }

  // ── TypeScript standalone (no package.json) ──────────────────────────────
  if (fileExists(dir, 'tsconfig.json') && hasExtension(dir, '.ts')) {
    return 'typescript'
  }

  // ── PHP ──────────────────────────────────────────────────────────────────
  if (fileExists(dir, 'composer.json')) {
    const pkg    = readJson(join(dir, 'composer.json'))
    const req    = pkg.require as Record<string, unknown> ?? {}
    if ('symfony/framework-bundle' in req)    return 'symfony'
    if (fileExists(dir, 'config', 'bundles.php')) return 'symfony'
    if ('laravel/framework' in req)           return 'laravel'
    return 'php'
  }

  // Also catch loose PHP files
  if (hasExtension(dir, '.php')) return 'php'

  // ── Mobile ───────────────────────────────────────────────────────────────
  if (fileExists(dir, 'pubspec.yaml')) {
    const content = readFileSync(join(dir, 'pubspec.yaml'), 'utf-8')
    if (content.includes('flutter')) return 'flutter'
    return 'unknown'
  }

  // ── Systems ──────────────────────────────────────────────────────────────
  if (fileExists(dir, 'Cargo.toml'))      return 'rust'
  if (fileExists(dir, 'go.mod'))          return 'go'

  // C++ before C (more specific)
  if (hasExtension(dir, '.cpp', '.cxx', '.cc') ||
      fileExists(dir, 'CMakeLists.txt'))  return 'cpp'
  if (hasExtension(dir, '.c') ||
      (fileExists(dir, 'Makefile') && !hasExtension(dir, '.java', '.kt')))
                                          return 'c'

  // ── JVM ──────────────────────────────────────────────────────────────────
  if (fileExists(dir, 'pom.xml'))         return 'java'
  if (hasExtension(dir, '.kt'))           return 'kotlin'
  if (fileExists(dir, 'build.gradle') || fileExists(dir, 'build.gradle.kts')) {
    if (hasExtension(dir, 'src', '.kt'))  return 'kotlin'
    return 'java'
  }
  if (hasExtension(dir, '.java'))         return 'java'

  // ── .NET ─────────────────────────────────────────────────────────────────
  if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln') || f.endsWith('.fsproj')))
                                          return 'dotnet'

  // ── Ruby ─────────────────────────────────────────────────────────────────
  if (fileExists(dir, 'Gemfile'))         return 'ruby'
  if (hasExtension(dir, '.rb'))           return 'ruby'

  // ── Python ───────────────────────────────────────────────────────────────
  if (fileExists(dir, 'requirements.txt') ||
      fileExists(dir, 'pyproject.toml')  ||
      fileExists(dir, 'setup.py')        ||
      fileExists(dir, 'Pipfile'))         return 'python'
  if (hasExtension(dir, '.py'))           return 'python'

  // ── Swift ────────────────────────────────────────────────────────────────
  if (hasExtension(dir, '.swift') ||
      fileExists(dir, 'Package.swift'))   return 'swift'

  // ── Shell scripts ─────────────────────────────────────────────────────────
  if (hasExtension(dir, '.sh', '.bash', '.zsh') &&
      !hasExtension(dir, '.html', '.css', '.js', '.ts'))
                                          return 'shell'

  // ── Docker-only projects ──────────────────────────────────────────────────
  if (fileExists(dir, 'Dockerfile') || fileExists(dir, 'docker-compose.yml') ||
      fileExists(dir, 'docker-compose.yaml')) return 'docker'

  // ── Static HTML / CSS ─────────────────────────────────────────────────────
  if (fileExists(dir, 'index.html') || fileExists(dir, 'index.htm') ||
      hasExtension(dir, '.html', '.htm')) return 'html'

  return 'unknown'
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export function scanDirectory(directory: string): DetectedProject[] {
  if (!existsSync(directory)) return []

  let entries: string[]
  try { entries = readdirSync(directory) } catch { return [] }

  const results: DetectedProject[] = []

  for (const entry of entries) {
    const fullPath = join(directory, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
      if (entry.startsWith('.'))             continue
    } catch { continue }

    const framework      = detectFramework(fullPath)
    const packageManager = detectPackageManager(fullPath)

    // Skip completely empty directories
    if (framework === 'unknown') {
      const hasContent = listDir(fullPath).length > 0
      if (!hasContent) continue
    }

    results.push({ name: entry, path: fullPath, framework, packageManager })
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}
