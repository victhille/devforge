#!/usr/bin/env node
// The CI's cache key for node_modules: package-lock.json without the app's own
// version, which every release changes while the packages stay the same.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const lock = JSON.parse(readFileSync('package-lock.json', 'utf-8'))
delete lock.version
if (lock.packages?.['']) delete lock.packages[''].version
process.stdout.write(createHash('sha256').update(JSON.stringify(lock)).digest('hex').slice(0, 20))
