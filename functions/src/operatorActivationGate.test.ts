import { describe, expect, it, vi } from 'vitest'

import type { OperatorActivationControlV1 } from '../../src/domain/recommendations/recommendationEvidence.js'
import { OperatorActivationGate } from './operatorActivationGate.js'

const request = {
  capability: 'generation',
  artifactVersion: 'fixture-rules@1.0.0',
  appProtocolVersion: 1,
  commandProtocolVersion: 1,
} as const

function control(): OperatorActivationControlV1 {
  return {
    schemaVersion: 'operator-activation-control@1',
    revision: 1,
    updatedAt: '2026-10-26T00:00:00.000Z',
    minimumAppProtocolVersion: 1,
    minimumCommandProtocolVersion: 1,
    capabilities: {
      generation: {
        enabled: true,
        approvedArtifactVersions: ['fixture-rules@1.0.0'],
      },
      guidance: { enabled: false, approvedArtifactVersions: [] },
      adaptation: { enabled: false, approvedArtifactVersions: [] },
    },
  }
}

describe('operator activation gate', () => {
  it('allows only the exact enabled and approved persisted state', async () => {
    const read = vi.fn(async () => control())
    const gate = new OperatorActivationGate({ read })

    await expect(gate.evaluate(request)).resolves.toEqual({
      allowed: true,
      reason: 'allowed',
    })
    expect(read).toHaveBeenCalledOnce()
  })

  it.each([
    ['disabled', { generation: { enabled: false } }, 'capability_disabled'],
    ['stale app', { minimumAppProtocolVersion: 2 }, 'stale_app_protocol'],
    ['stale command', { minimumCommandProtocolVersion: 2 }, 'stale_command_protocol'],
    [
      'not allowlisted',
      { generation: { approvedArtifactVersions: ['other-rules@1.0.0'] } },
      'artifact_not_approved',
    ],
  ] as const)('fails closed when the control is %s', async (_, change, reason) => {
    const stored = control()
    const generation =
      'generation' in change
        ? { ...stored.capabilities.generation, ...change.generation }
        : stored.capabilities.generation
    const controlChange = 'generation' in change ? {} : change
    const changed = {
      ...stored,
      ...controlChange,
      capabilities: { ...stored.capabilities, generation },
    }
    const gate = new OperatorActivationGate({ read: async () => changed })

    await expect(gate.evaluate(request)).resolves.toEqual({
      allowed: false,
      reason,
    })
  })

  it('rejects a draft request even if a reader returns an invalid draft allowlist', async () => {
    const gate = new OperatorActivationGate({ read: async () => control() })

    await expect(
      gate.evaluate({ ...request, artifactVersion: 'fixture-rules@1.0.0-draft' }),
    ).resolves.toEqual({ allowed: false, reason: 'draft_artifact' })
  })

  it('collapses a missing or unreadable control into an invalid-control decision', async () => {
    const read = vi.fn(async (): Promise<OperatorActivationControlV1> => {
      throw new Error('control-not-found')
    })
    const gate = new OperatorActivationGate({ read })

    await expect(gate.evaluate(request)).resolves.toEqual({
      allowed: false,
      reason: 'invalid_control',
    })
  })
})
