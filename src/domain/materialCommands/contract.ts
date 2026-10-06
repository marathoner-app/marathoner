export const MATERIAL_COMMAND_ENVELOPE_VERSION = 1 as const
export const MATERIAL_COMMAND_APP_PROTOCOL_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_SCHEMA_VERSION = 1 as const
export const MATERIAL_COMMAND_PROOF_TYPE = 'proof.material-command' as const
export const MATERIAL_COMMAND_PROOF_VARIANTS = ['default', 'alternate'] as const
export const ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION = 1 as const
export const ACCOUNT_DELETION_REQUEST_TYPE = 'account.request-deletion' as const

const commandIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

interface MaterialCommandEnvelopeBase {
  envelopeVersion: typeof MATERIAL_COMMAND_ENVELOPE_VERSION
  appProtocolVersion: typeof MATERIAL_COMMAND_APP_PROTOCOL_VERSION
  commandId: string
}

export interface ProofMaterialCommandEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof MATERIAL_COMMAND_PROOF_TYPE
    schemaVersion: typeof MATERIAL_COMMAND_PROOF_SCHEMA_VERSION
    proofVariant: (typeof MATERIAL_COMMAND_PROOF_VARIANTS)[number]
  }
}

export interface AccountDeletionRequestEnvelope
  extends MaterialCommandEnvelopeBase {
  command: {
    type: typeof ACCOUNT_DELETION_REQUEST_TYPE
    schemaVersion: typeof ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION
  }
}

export type MaterialCommandEnvelope =
  | ProofMaterialCommandEnvelope
  | AccountDeletionRequestEnvelope

export function isProofMaterialCommandEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is ProofMaterialCommandEnvelope {
  return envelope.command.type === MATERIAL_COMMAND_PROOF_TYPE
}

export function isAccountDeletionRequestEnvelope(
  envelope: MaterialCommandEnvelope,
): envelope is AccountDeletionRequestEnvelope {
  return envelope.command.type === ACCOUNT_DELETION_REQUEST_TYPE
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

export interface AccountDeletionRequestAcceptedResult {
  status: 'accepted'
  commandId: string
  requestId: string
  requestedAt: string
  completionDueAt: string
  accessLocked: true
}

export interface MaterialCommandValidationResult
  extends MaterialCommandFailure {
  status: 'validation_error'
  code:
    | 'invalid-envelope'
    | 'ownership-field-prohibited'
    | 'target-field-prohibited'
}

export interface MaterialCommandAuthenticationResult
  extends MaterialCommandFailure {
  status: 'authentication_error'
  code:
    | 'authentication-required'
    | 'verified-email-required'
    | 'recent-authentication-required'
}

export interface MaterialCommandAuthorizationResult
  extends MaterialCommandFailure {
  status: 'authorization_error'
  code:
    | 'app-check-required'
    | 'app-check-token-replayed'
    | 'approved-beta-membership-required'
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
  | AccountDeletionRequestAcceptedResult
  | MaterialCommandValidationResult
  | MaterialCommandAuthenticationResult
  | MaterialCommandAuthorizationResult
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

function hasProhibitedTargetField(value: Record<string, unknown>): boolean {
  const hasTargetField = (candidate: unknown) =>
    isRecord(candidate) &&
    ('email' in candidate || 'path' in candidate || 'projectId' in candidate)
  if (hasTargetField(value)) return true
  const command = value.command
  if (!isRecord(command)) return false
  return hasTargetField(command) || hasTargetField(command.payload)
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

  if (hasProhibitedTargetField(value)) {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'target-field-prohibited',
        'Deletion targets must come from the authenticated session and server configuration.',
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
  if (!isRecord(command) || typeof command.type !== 'string') {
    return {
      ok: false,
      result: validationResult(
        commandId,
        'invalid-envelope',
        'The command type is not supported.',
      ),
    }
  }

  if (command.type === MATERIAL_COMMAND_PROOF_TYPE) {
    if (
      !hasExactKeys(command, ['proofVariant', 'schemaVersion', 'type']) ||
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
          proofVariant:
            command.proofVariant as ProofMaterialCommandEnvelope['command']['proofVariant'],
        },
      },
    }
  }

  if (command.type === ACCOUNT_DELETION_REQUEST_TYPE) {
    if (!hasExactKeys(command, ['schemaVersion', 'type'])) {
      return {
        ok: false,
        result: validationResult(
          commandId,
          'invalid-envelope',
          'The command type is not supported.',
        ),
      }
    }
    if (command.schemaVersion !== ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION) {
      return {
        ok: false,
        result: unsupportedVersionResult(
          commandId,
          'unsupported-command-schema-version',
          ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
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
          type: ACCOUNT_DELETION_REQUEST_TYPE,
          schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
        },
      },
    }
  }

  return {
    ok: false,
    result: validationResult(
      commandId,
      'invalid-envelope',
      'The command type is not supported.',
    ),
  }
}

export function materialCommandSignature(
  envelope: MaterialCommandEnvelope,
): string {
  const signature: Array<string | number> = [
    envelope.envelopeVersion,
    envelope.appProtocolVersion,
    envelope.command.type,
    envelope.command.schemaVersion,
  ]
  if (isProofMaterialCommandEnvelope(envelope)) {
    signature.push(envelope.command.proofVariant)
  }
  return signature.join(':')
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

  if (value.status === 'accepted') {
    return (
      typeof value.commandId === 'string' &&
      typeof value.requestId === 'string' &&
      value.requestId.length >= 16 &&
      value.requestId.length <= 128 &&
      typeof value.requestedAt === 'string' &&
      typeof value.completionDueAt === 'string' &&
      value.accessLocked === true
    )
  }

  if (typeof value.message !== 'string' || typeof value.code !== 'string') {
    return false
  }

  switch (value.status) {
    case 'validation_error':
      return (
        value.code === 'invalid-envelope' ||
        value.code === 'ownership-field-prohibited' ||
        value.code === 'target-field-prohibited'
      )
    case 'authentication_error':
      return [
        'authentication-required',
        'verified-email-required',
        'recent-authentication-required',
      ].includes(value.code)
    case 'authorization_error':
      return [
        'app-check-required',
        'app-check-token-replayed',
        'approved-beta-membership-required',
      ].includes(value.code)
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
  proofVariant: ProofMaterialCommandEnvelope['command']['proofVariant'] = 'default',
): ProofMaterialCommandEnvelope {
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
  if (!isProofMaterialCommandEnvelope(parsed.envelope)) {
    throw new Error('The proof command parsed as the wrong command type.')
  }
  return parsed.envelope
}

export function createAccountDeletionRequest(
  commandId: string,
): AccountDeletionRequestEnvelope {
  const parsed = parseMaterialCommand({
    envelopeVersion: MATERIAL_COMMAND_ENVELOPE_VERSION,
    appProtocolVersion: MATERIAL_COMMAND_APP_PROTOCOL_VERSION,
    commandId,
    command: {
      type: ACCOUNT_DELETION_REQUEST_TYPE,
      schemaVersion: ACCOUNT_DELETION_REQUEST_SCHEMA_VERSION,
    },
  })
  if (!parsed.ok) throw new Error(parsed.result.message)
  if (!isAccountDeletionRequestEnvelope(parsed.envelope)) {
    throw new Error('The deletion request parsed as the wrong command type.')
  }
  return parsed.envelope
}
