import { describe, expect, it } from 'vitest'

import { isApprovedBetaMembership } from './approvedBetaMembership.js'

const ownerId = 'runner-one'

function approvedMembership() {
  return {
    schemaVersion: 1,
    userId: ownerId,
    status: 'approved',
    approvedAt: { toDate: () => new Date('2026-10-01T00:00:00.000Z') },
    approvedBy: 'membership-test-operator',
  }
}

describe('approved beta membership', () => {
  it('accepts only the exact approved record owned by the caller', () => {
    expect(isApprovedBetaMembership(approvedMembership(), ownerId)).toBe(true)

    for (const membership of [
      undefined,
      { ...approvedMembership(), userId: 'runner-two' },
      { ...approvedMembership(), status: 'invited' },
      { ...approvedMembership(), schemaVersion: 2 },
      { ...approvedMembership(), approvedBy: '' },
      { ...approvedMembership(), approvedAt: '2026-10-01' },
      { ...approvedMembership(), unexpected: true },
    ]) {
      expect(isApprovedBetaMembership(membership, ownerId)).toBe(false)
    }
  })
})
