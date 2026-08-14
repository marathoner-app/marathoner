import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx']
const sensitiveLiterals = [
  /creator-radar-events-dev@marathoner-d9bf9\.iam\.gserviceaccount\.com/i,
  /\/integrations\/marathoner\/v1\/events/i,
  /ingestMarathonerEvent/i,
]
const importSpecifierPattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function isWithinRoot(root, path) {
  const difference = relative(root, path)
  return difference === '' || (!difference.startsWith(`..${sep}`) && difference !== '..' && !isAbsolute(difference))
}

function importSpecifiers(contents) {
  return [...contents.matchAll(importSpecifierPattern)].map((match) => match[1] ?? match[2])
}

function candidatePaths(importer, specifier) {
  const base = resolve(dirname(importer), specifier)
  if (extname(base)) return [base]
  return [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => resolve(base, `index${extension}`)),
  ]
}

export function findBrowserBoundaryViolations({ clientRoot, sourceFiles }) {
  const normalizedRoot = resolve(clientRoot)
  const knownFiles = new Set([...sourceFiles.keys()].map((path) => resolve(path)))
  const violations = []

  for (const [path, contents] of sourceFiles) {
    const normalizedPath = resolve(path)
    if (!isWithinRoot(normalizedRoot, normalizedPath)) {
      violations.push(`${relative(normalizedRoot, normalizedPath)} is outside the browser root`)
      continue
    }
    if (sensitiveLiterals.some((pattern) => pattern.test(contents))) {
      violations.push(`${relative(normalizedRoot, normalizedPath)} contains server-only integration material`)
    }

    for (const specifier of importSpecifiers(contents)) {
      if (!specifier.startsWith('.')) continue
      const candidates = candidatePaths(normalizedPath, specifier)
      const resolvedImport = candidates.find((candidate) => knownFiles.has(candidate)) ?? candidates[0]
      if (resolvedImport !== undefined && !isWithinRoot(normalizedRoot, resolvedImport)) {
        violations.push(`${relative(normalizedRoot, normalizedPath)} imports outside src via ${specifier}`)
      }
    }
  }

  return [...new Set(violations)].sort()
}
