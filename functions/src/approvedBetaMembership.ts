import type { DocumentData } from 'firebase-admin/firestore'

export function approvedBetaMembershipPath(ownerId: string): string {
  return `betaMemberships/${ownerId}`
}

function hasExactKeys(data: DocumentData, keys: readonly string[]): boolean {
  const actual = Object.keys(data).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

export function isApprovedBetaMembership(
  data: DocumentData | undefined,
  ownerId: string,
): boolean {
  return (
    data !== undefined &&
    hasExactKeys(data, [
      'approvedAt',
      'approvedBy',
      'schemaVersion',
      'status',
      'userId',
    ]) &&
    data.schemaVersion === 1 &&
    data.userId === ownerId &&
    data.status === 'approved' &&
    typeof data.approvedBy === 'string' &&
    data.approvedBy.length > 0 &&
    data.approvedBy.length <= 128 &&
    typeof data.approvedAt?.toDate === 'function'
  )
}
