const durableFirestorePatterns = [
  ['persistentLocalCache', 'persistentLocalCache'],
  ['persistentSingleTabManager', 'persistentSingleTabManager'],
  ['persistentMultipleTabManager', 'persistentMultipleTabManager'],
  ['enableIndexedDbPersistence', 'enableIndexedDbPersistence'],
  ['enableMultiTabIndexedDbPersistence', 'enableMultiTabIndexedDbPersistence'],
]

const durableTrainingStoragePattern =
  /\b(?:localStorage|sessionStorage|indexedDB|AsyncStorage|SQLite)\b/i

export function findTrainingCachePolicyViolations({
  firebaseClientFactory,
  trainingSources,
}) {
  const violations = []

  if (!/\bmemoryLocalCache\b/.test(firebaseClientFactory)) {
    violations.push('Firebase client does not import memoryLocalCache')
  }

  if (
    !/initializeFirestore\s*\(\s*app\s*,\s*\{[\s\S]*?localCache\s*:\s*memoryLocalCache\s*\(\s*\)/m.test(
      firebaseClientFactory,
    )
  ) {
    violations.push('Firestore is not initialized with memoryLocalCache()')
  }

  for (const [name, pattern] of durableFirestorePatterns) {
    if (firebaseClientFactory.includes(pattern)) {
      violations.push(`Firebase client contains forbidden ${name}`)
    }
  }

  for (const [path, source] of trainingSources) {
    const match = source.match(durableTrainingStoragePattern)
    if (match) {
      violations.push(`${path} contains forbidden durable storage ${match[0]}`)
    }
  }

  return violations
}
