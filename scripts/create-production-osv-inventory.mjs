import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function createProductionOsvInventory(dependencies) {
  if (!Array.isArray(dependencies)) {
    throw new Error('Expected npm query to return a dependency array.')
  }

  const uniquePackages = new Map()

  for (const dependency of dependencies) {
    const name =
      typeof dependency?.name === 'string' ? dependency.name.trim() : ''
    const version =
      typeof dependency?.version === 'string' ? dependency.version.trim() : ''

    if (!name || !version) {
      continue
    }

    uniquePackages.set(`${name}\0${version}`, {
      package: {
        ecosystem: 'npm',
        name,
        version,
      },
    })
  }

  const packages = [...uniquePackages.values()].sort((left, right) => {
    const nameComparison = left.package.name.localeCompare(right.package.name)
    return nameComparison || left.package.version.localeCompare(right.package.version)
  })

  if (packages.length === 0) {
    throw new Error('Production dependency inventory is empty; scan is blocked.')
  }

  return {
    results: [{ packages }],
  }
}

async function run() {
  const [inputPath, outputPath] = process.argv.slice(2)
  if (!inputPath || !outputPath) {
    throw new Error(
      'Usage: node scripts/create-production-osv-inventory.mjs <npm-query.json> <osv-inventory.json>',
    )
  }

  const dependencies = JSON.parse(await readFile(inputPath, 'utf8'))
  const inventory = createProductionOsvInventory(dependencies)
  const packageCount = inventory.results[0].packages.length

  await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`)
  console.log(`Prepared ${packageCount} production packages for OSV Scanner.`)
}

const executedFile = process.argv[1]
if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
