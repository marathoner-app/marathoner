export const MATERIAL_COMMAND_ENVELOPE_VERSION = 1 as const
export const MATERIAL_COMMAND_APP_PROTOCOL_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_SCHEMA_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_TYPE = 'proof.material-command' as const
export const MATERIAL_COMMAND_PROOF_VARIANTS = ['default', 'alternate'] as const

const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

export interface MaterialCommandEnvelope {
  envelopeVersion: typeof MATERIAL_COMMAND_ENVELOPE_VERSION
  appProtocolVersion: typeof MATERIAL_COMMAND_APP_PROTOCOL_VERSION
  commandId: string
  command: {
    type: typeof MATERIAL_COMMAND_PROOF_TYPE
    schemaVersion: typeof MATERIAL_COMMAND_PROOF_SCHEMA_VERSION
    proofVariant: (typeof MATERIAL_COMMAND_PROOF_VARIANTS)[number]
  }
}

interface MaterialCommandFailure {
  commandId: string | null
  message: string
}

export interface MaterialCommandCommittedResult {
  status: 'committed'
  commandId: string
  committedAt: string
  proofCount: number
}

export interface MaterialCommandValidationResult
  extends MaterialCommandFailure {
  status: 'validation_error'
  code: 'invalid-envelope' | 'ownership-field-prohibited'
}

export interface MaterialCommandAuthenticationResult
  extends MaterialCommandFailure {
  status: 'authentication_error'
  code: 'authentication-required'
}

export interface MaterialCommandUnsupportedVersionResult
  extends MaterialCommandFailure {
  status: 'unsupported_version'
  code:
    | 'unsupported-envelope-version'
    | 'unsupported-app-protocol-version'
    | 'unsupported-command-schema-version'
  supportedVersion: number
}

export interface MaterialCommandConflictResult extends MaterialCommandFailure {
  status: 'conflict'
  code: 'command-id-reused'
}

export interface MaterialCommandRetryableResult extends MaterialCommandFailure {
  status: 'retryable_error'
  code: 'temporarily-unavailable'
}

export interface MaterialCommandOutcomeUnknownResult
  extends MaterialCommandFailure {
  status: 'outcome_unknown'
  code: 'resolve-by-command-id'
}

export type MaterialCommandResult =
  | MaterialCommandCommittedResult
  | MaterialCommandValidationResult
  | MaterialCommandAuthenticationResult
  | MaterialCommandUnsupportedVersionResult
  | MaterialCommandConflictResult
  | MaterialCommandRetryableResult
  | MaterialCommandOutcomeUnknownResult

export type ParsedMaterialCommand =
  | { ok: true; envelope: MaterialCommandEnvelope }
  | {
      ok: false
      result: MaterialCommandValidationResult | MaterialCommandUnsupportedVersionResult
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

function hasDirectOwnershipField(value: unknown): boolean {
  return (
    isRecord(value) &&
    ('userId' in value || 'ownerId' in value || 'uid' in value)
  )
}

function hasOwnershipField(value: Record<string, unknown>): boolean {
  if (hasDirectOwnershipField(value)) return true
  const command = value.command
  if (!isRecord(command)) return false
  return (
    hasDirectOwnershipField(command) ||
    hasDirectOwnershipField(command.payload)
  )
}

export function materialCommandIdFrom(value: unknown): string | null {
  if (!isRecord(value)) return null
  const commandId = value.commandId
  return typeof commandId === 'string' && commandIdPattern.test(commandId)
    ? commandId
    : null
}

function validationResult(
  commandId: string | null,
  code: MaterialCommandValidationResult['code'],
  message: string,
): MaterialCommandValidationResult {
  return { status: 'validation_error', commandId, code, message }
}

function unsupportedVersionResult(
  commandId: string | null,
  code: MaterialCommandUnsupportedVersionResult['code'],
  supportedVersion: number,
): MaterialCommandUnsupportedVersionResult {
  return {
    status: 'unsupported_version',
    commandId,
    code,
    message: 'Update Marathoner before retrying this command.',
    supportedVersion,
  }
}

export function parseMaterialCommand(value: unknown): ParsedMaterialCommand {
  const commandId = materialCommandIdFrom(value)
  if (!isRecord(value)) {
    return {
      ok: false,
      result: validationResult(
        null,
        'invalid-envelope',
        'The command envelope is invalid.',
      ),
    }
  }

  if (hasOwnershipField(value)) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'ownership-field-prohibited',
        'User ownership must come from the authenticated session.',
      ),
    }
  }

  if (!hasExactKeys(value, [
    'appProtocolVersion',
    'command',
    'commandId',
    'envelopeVersion',
  ]) || commandId === null) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'invalid-envelope',
        'The command envelope is invalid.',
      ),
    }
  }

  if (value.envelopeVersion !== MATERIAL_COMMAND_ENVELOPE_VERSION) {
    return {
      ok: false,
      result: unsupportedVersionResult(
        commandId,
        'unsupported-envelope-version',
        MATERIAL_COMMAND_ENVELOPE_VERSION,
      ),
    }
  }

  if (value.appProtocolVersion !== MATERIAL_COMMAND_APP_PROTOCOL_VERSION) {
    return {
      ok: false,
      result: unsupportedVersionResult(
        commandId,
        'unsupported-app-protocol-version',
        MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
      ),
    }
  }

  const command = value.command
  if (
    !isRecord(command) ||
    !hasExactKeys(command, ['proofVariant', 'schemaVersion', 'type']) ||
    command.type !== MATERIAL_COMMAND_PROOF_TYPE ||
    !MATERIAL_COMMAND_PROOF_VARIANTS.includes(
      command.proofVariant as (typeof MATERIAL_COMMAND_PROOF_VARIANTS)[number],
    )
  ) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'invalid-envelope',
        'The command type is not supported.',
      ),
    }
  }

  if (command.schemaVersion !== MATERIAL_COMMAND_PROOF_SCHEMA_VERSION) {
    return {
      ok: false,
      result: unsupportedVersionResult(
        commandId,
        'unsupported-command-schema-version',
        MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
      ),
    }
  }

  return {
    ok: true,
    envelope: {
      envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
      appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
      commandId,
      command: {
        type: MATERIAL_COMMAND_PROOF_TYPE,
        schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
        proofVariant: command.proofVariant as MaterialCommandEnvelope['command']['proofVariant'],
      },
    },
  }
}

export function materialCommandSignature(
  envelope: MaterialCommandEnvelope,
): string {
  return [
    envelope.envelopeVersion,
    envelope.appProtocolVersion,
    envelope.command.type,
    envelope.command.schemaVersion,
    envelope.command.proofVariant,
  ].join(':')
}

export function isMaterialCommandResult(
  value: unknown,
): value is MaterialCommandResult {
  if (!isRecord(value) || typeof value.status !== 'string') return false
  if (
    value.commandId !== null &&
    (typeof value.commandId !== 'string' || !commandIdPattern.test(value.commandId))
  ) {
    return false
  }

  if (value.status === 'committed') {
    return (
      typeof value.commandId === 'string' &&
      typeof value.committedAt === 'string' &&
      Number.isInteger(value.proofCount) &&
      Number(value.proofCount) >= 1
    )
  }

  if (typeof value.message !== 'string' || typeof value.code !== 'string') {
    return false
  }

  switch (value.status) {
    case 'validation_error':
      return (
        value.code === 'invalid-envelope' ||
        value.code === 'ownership-field-prohibited'
      )
    case 'authentication_error':
      return value.code === 'authentication-required'
    case 'unsupported_version':
      return (
        [
          'unsupported-envelope-version',
          'unsupported-app-protocol-version',
          'unsupported-command-schema-version',
        ].includes(value.code) && Number.isInteger(value.supportedVersion)
      )
    case 'conflict':
      return value.code === 'command-id-reused'
    case 'retryable_error':
      return value.code === 'temporarily-unavailable'
    case 'outcome_unknown':
      return value.code === 'resolve-by-command-id'
    default:
      return false
  }
}

export function createProofMaterialCommand(
  commandId: string,
  proofVariant: MaterialCommandEnvelope['command']['proofVariant'] = 'default',
): MaterialCommandEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: MATERIAL_COMMAND_PROOF_TYPE,
      schemaVersion: MATERIAL_COMMAND_PROOF_SCHEMA_VERSION,
      proofVariant,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  return parsed.envelope
}
