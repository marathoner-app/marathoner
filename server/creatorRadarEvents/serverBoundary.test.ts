// @vitest-environment node

import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findBrowserBoundaryViolations } from '../../scripts/server-boundary-policy.mjs'

const root = resolve('/fictional/repository/src')

function sources(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries).map(([path, contents]) => [resolve(root, path), contents]))
}

describe('browser/server source boundary policy', () => {
  it('accepts an entirely in-src import graph', () => {
    expect(findBrowserBoundaryViolations({
      clientRoot: root,
      sourceFiles: sources({
        'main.ts': "import { value } from './feature/index.ts'",
        'feature/index.ts': "export { value } from './value.ts'",
        'feature/value.ts': 'export const value = 1',
      }),
    })).toEqual([])
  })

  it('rejects direct and indirect re-export paths that leave src', () => {
    expect(findBrowserBoundaryViolations({
      clientRoot: root,
      sourceFiles: sources({
        'main.ts': "import './bridge.ts'",
        'bridge.ts': "export * from '../server/creatorRadarEvents/index.ts'",
      }),
    })).toEqual(['bridge.ts imports outside src via ../server/creatorRadarEvents/index.ts'])
  })

  it('rejects copied server-only identity or endpoint material anywhere in src', () => {
    expect(findBrowserBoundaryViolations({
      clientRoot: root,
      sourceFiles: sources({
        'configuration.ts': "export const endpoint = 'https://example.test/ingestMarathonerEvent'",
      }),
    })).toEqual(['configuration.ts contains server-only integration material'])
  })
})
