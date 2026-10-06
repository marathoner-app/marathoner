import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
  MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
  MATERIAL_COMMAND_ENVELOPE_VERSION,
  MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
  createAccountDeletionRequest,
  createProofMaterialCommand,
  isMaterialCommandResult,
  materialCommandSignature,
  parseMaterialCommand,
} from './contract'

const commandId = 'proof-command-0001'

describe('material-command contract', () => {
  it('creates and parses the supported proof command', () => {
    const command = createProofMaterialCommand(commandId)

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(materialCommandSignature(command)).toBe(
      '1:1:proof.material-command:1:default',
    )
  })

  it('creates the payload-free account-deletion request', () => {
    const command = createAccountDeletionRequest('delete-command-0001')

    expect(parseMaterialCommand(command)).toEqual({
      ok: true,
      envelope: command,
    })
    expect(materialCommandSignature(command)).toBe(
      '1:1:account.request-deletion:1',
    )
  })

  it('rejects ownership supplied by the request payload', () => {
    const command = {
      ...createProofMaterialCommand(commandId),
      command: {
        ...createProofMaterialCommand(commandId).command,
        payload: { userId: 'another-runner' },
      },
    }

    expect(parseMaterialCommand(command)).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    })
  })

  it.each(['email', 'path', 'projectId'])(
    'rejects caller-supplied deletion target field %s',
    (field) => {
      expect(
        parseMaterialCommand({
          ...createAccountDeletionRequest('delete-command-target'),
          [field]: 'another-target',
        }),
      ).toEqual({
        ok: false,
        result: expect.objectContaining({
          status: 'validation_error',
          code: 'target-field-prohibited',
        }),
      })
    },
  )

  it.each([
    [
      'envelopeVersion',
      { envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION + 1 },
      'unsupported-envelope-version',
    ],
    [
      'appProtocolVersion',
      { appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION + 1 },
      'unsupported-app-protocol-version',
    ],
    [
      'command schema',
      {
        command: {
          type: 'proof.material-command',
          schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION + 1,
          proofVariant: 'default',
        },
      },
      'unsupported-command-schema-version',
    ],
    [
      'deletion command schema',
      {
        command: {
          type: 'account.request-deletion',
          schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION + 1,
        },
      },
      'unsupported-command-schema-version',
    ],
  ])('returns a typed result for an unsupported %s', (_, change, code) => {
    const command = { ...createProofMaterialCommand(commandId), ...change }

    expect(parseMaterialCommand(command)).toEqual({
      ok: false,
      result: expect.objectContaining({
        status: 'unsupported_version',
        code,
      }),
    })
  })

  it('recognizes the typed accepted deletion result', () => {
    expect(
      isMaterialCommandResult({
        status: 'accepted',
        commandId: 'delete-command-0001',
        requestId: '11111111-1111-4111-8111-111111111111',
        requestedAt: '2026-10-05T00:00:00.000Z',
        completionDueAt: '2026-10-12T00:00:00.000Z',
        accessLocked: true,
      }),
    ).toBe(true)
  })

  it('rejects malformed command IDs and unknown command fields', () => {
    expect(
      parseMaterialCommand({
        ...createProofMaterialCommand(commandId),
        commandId: 'short',
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({ status: 'validation_error' }),
    })
    expect(
      parseMaterialCommand({
        ...createProofMaterialCommand(commandId),
        extra: true,
      }),
    ).toEqual({
      ok: false,
      result: expect.objectContaining({ status: 'validation_error' }),
    })
  })
})
