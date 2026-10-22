import { describe, expect, it } from 'vitest'
import { createProductionOsvInventory } from './create-production-osv-inventory.mjs'

describe('production OSV dependency inventory', () => {
  it('creates a sorted, deduplicated npm package list', () => {
    const inventory = createProductionOsvInventory([
      { name: 'react', version: '18.3.1' },
      { name: 'firebase', version: '12.19.0' },
      { name: 'react', version: '18.3.1' },
    ])

    expect(inventory).toEqual({
      results: [
        {
          packages: [
            {
              package: {
                ecosystem: 'npm',
                name: 'firebase',
                version: '12.19.0',
              },
            },
            {
              package: {
                ecosystem: 'npm',
                name: 'react',
                version: '18.3.1',
              },
            },
          ],
        },
      ],
    })
  })

  it('ignores dependency records without both a name and version', () => {
    const inventory = createProductionOsvInventory([
      { name: 'react', version: '18.3.1' },
      { name: '', version: '1.0.0' },
      { name: 'missing-version' },
      null,
    ])

    expect(inventory.results[0].packages).toHaveLength(1)
  })

  it('fails closed when npm does not return scannable dependencies', () => {
    expect(() => createProductionOsvInventory([])).toThrow(
      'Production dependency inventory is empty',
    )
    expect(() => createProductionOsvInventory({})).toThrow(
      'Expected npm query to return a dependency array',
    )
  })
})
