import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowserBoundaryViolations } from './server-boundary-policy.mjs'

const clientRoot = fileURLToPath(new URL('../src/', import.meta.url))

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  }))
  return files.flat().filter((path) => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(path)))
}

const sources = new Map()
for (const path of await sourceFiles(clientRoot)) {
  sources.set(path, await readFile(path, 'utf8'))
}
const violations = findBrowserBoundaryViolations({ clientRoot, sourceFiles: sources })

if (violations.length > 0) {
  throw new Error(`Browser source crossed the Creator Radar server boundary: ${violations.join(', ')}`)
}

const rootTsconfig = await readFile(new URL('../tsconfig.json', import.meta.url), 'utf8')
const appTsconfig = await readFile(new URL('../tsconfig.app.json', import.meta.url), 'utf8')
const serverTsconfig = await readFile(new URL('../tsconfig.server.json', import.meta.url), 'utf8')
if (!rootTsconfig.includes('"./tsconfig.server.json"')
  || !appTsconfig.includes('"include": ["src"]')
  || appTsconfig.includes('server/**')
  || !serverTsconfig.includes('"include": ["server/**/*.ts"]')) {
  throw new Error('TypeScript project references no longer preserve the browser/server split.')
}

console.log('Creator Radar publisher remains outside the browser graph and inside the root TypeScript build.')
