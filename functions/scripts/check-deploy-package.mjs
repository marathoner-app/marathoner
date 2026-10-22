import { readFile } from 'node:fs/promises'

const functionsRoot = new URL('../', import.meta.url)
const canonicalRoot = new URL('../packages/training-contract/', functionsRoot)
const vendoredRoot = new URL('vendor/training-contract/', functionsRoot)

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

async function requireMatchingFile(relativePath) {
  const [canonical, vendored] = await Promise.all([
    readFile(new URL(relativePath, canonicalRoot), 'utf8'),
    readFile(new URL(relativePath, vendoredRoot), 'utf8'),
  ])

  if (canonical !== vendored) {
    throw new Error(
      `Vendored training contract ${relativePath} differs from the canonical package.`,
    )
  }
}

const [functionsPackage, vendoredPackage] = await Promise.all([
  readJson(new URL('package.json', functionsRoot)),
  readJson(new URL('package.json', vendoredRoot)),
])

if (
  functionsPackage.dependencies?.['@marathoner/training-contract'] !==
  'file:vendor/training-contract'
) {
  throw new Error(
    'The Functions deployment must install the vendored training contract.',
  )
}

if (
  vendoredPackage.name !== '@marathoner/training-contract' ||
  vendoredPackage.type !== 'module' ||
  vendoredPackage.exports?.['.']?.import !== './src/index.mjs' ||
  vendoredPackage.exports?.['.']?.types !== './src/index.d.ts'
) {
  throw new Error('The vendored training contract package boundary is invalid.')
}

await Promise.all([
  requireMatchingFile('src/index.mjs'),
  requireMatchingFile('src/index.d.ts'),
])

const compiledImports = await Promise.all([
  readFile(
    new URL('lib/src/domain/training/identifiers.js', functionsRoot),
    'utf8',
  ),
  readFile(
    new URL('lib/src/domain/training/units.js', functionsRoot),
    'utf8',
  ),
])
if (
  compiledImports.some(
    (source) => !source.includes('from "@marathoner/training-contract"'),
  )
) {
  throw new Error(
    'Expected the compiled Functions domain to load the deployable training contract.',
  )
}

console.log('Functions deployment includes the canonical training contract runtime.')
