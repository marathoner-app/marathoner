import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const READINESS_SCHEMA_VERSION =
  'closed-beta-methodology-readiness@1'

export const REQUIRED_CLIENT_STATES = [
  'allowed',
  'denied',
  'stale_version',
  'unavailable_artifact',
  'unsupported',
  'symptom_escalation',
  'disabled',
  'recovery',
]

export const REQUIRED_CONTROL_PROOFS = [
  'kill_switch',
  'artifact_retirement',
  'rollback',
  'recovery',
]

export const REQUIRED_OPERATIONAL_PROOFS = [
  'limitations',
  'support',
  'incident',
  'privacy',
  'release_checklist',
]

const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
)
const defaultManifestPath = path.join(
  repositoryRoot,
  'docs/methodology/artifacts/closed-beta-provisional-methodology/0.1.0/manifest.json',
)

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function completedText(value) {
  return nonBlank(value) && value.trim().toUpperCase() !== 'PENDING'
}

function dateOnly(value) {
  if (!completedText(value) || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
}

function timestamp(value) {
  if (
    !completedText(value) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false
  }
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

function exactArtifactVersions(manifest) {
  return Object.fromEntries(
    manifest.artifacts.map(({ kind, version }) => [kind, version]),
  )
}

function checkProofGroup(failures, group, requiredKeys, label) {
  if (!isRecord(group)) {
    failures.push(`${label} evidence is missing.`)
    return
  }

  for (const key of requiredKeys) {
    const proof = group[key]
    if (!isRecord(proof)) {
      failures.push(`${label}.${key} evidence is missing.`)
      continue
    }
    if (proof.status !== 'pass') {
      failures.push(`${label}.${key} is ${String(proof.status ?? 'missing')}.`)
    }
    if (!completedText(proof.evidence)) {
      failures.push(`${label}.${key} has no evidence reference.`)
    }
  }
}

function checkClient(
  failures,
  client,
  clientName,
  physicalIos,
  releaseIdentifier,
) {
  if (!isRecord(client)) {
    failures.push(`${clientName} evidence is missing.`)
    return
  }
  if (!completedText(client.candidate)) {
    failures.push(`${clientName} has no candidate identifier.`)
  }
  if (client.releaseIdentifier !== releaseIdentifier) {
    failures.push(
      `${clientName} releaseIdentifier does not match the locked candidate.`,
    )
  }
  if (!timestamp(client.recordedAt)) {
    failures.push(`${clientName} has no recorded timestamp.`)
  }
  if (!completedText(client.tester)) {
    failures.push(`${clientName} has no tester role.`)
  }
  if (physicalIos && client.physicalDevice !== true) {
    failures.push('physicalIos must be recorded on a physical device.')
  }
  checkProofGroup(
    failures,
    client.states,
    REQUIRED_CLIENT_STATES,
    `${clientName}.states`,
  )
}

export function evaluateClosedBetaMethodologyReadiness(record, manifest) {
  const failures = []
  if (!isRecord(record)) {
    return ['The readiness record is not an object.']
  }
  if (record.schemaVersion !== READINESS_SCHEMA_VERSION) {
    failures.push(
      `schemaVersion must be ${READINESS_SCHEMA_VERSION}.`,
    )
  }
  if (!dateOnly(record.recordedOn)) {
    failures.push('recordedOn is missing.')
  }

  const candidate = record.candidate
  let releaseIdentifier
  if (!isRecord(candidate)) {
    failures.push('candidate metadata is missing.')
  } else {
    if (!completedText(candidate.releaseIdentifier)) {
      failures.push('candidate.releaseIdentifier is missing.')
    } else {
      releaseIdentifier = candidate.releaseIdentifier
    }
    if (candidate.manifestVersion !== manifest.manifestVersion) {
      failures.push(
        `candidate manifest ${String(candidate.manifestVersion)} does not match ${manifest.manifestVersion}.`,
      )
    }
    const expectedArtifacts = exactArtifactVersions(manifest)
    if (!isRecord(candidate.artifactVersions)) {
      failures.push('candidate.artifactVersions is missing.')
    } else {
      for (const [kind, version] of Object.entries(expectedArtifacts)) {
        if (candidate.artifactVersions[kind] !== version) {
          failures.push(
            `candidate ${kind} artifact ${String(candidate.artifactVersions[kind])} does not match ${version}.`,
          )
        }
      }
    }
  }

  const clients = record.clients
  if (!isRecord(clients)) {
    failures.push('client evidence is missing.')
  } else {
    checkClient(
      failures,
      clients.responsiveWeb,
      'responsiveWeb',
      false,
      releaseIdentifier,
    )
    checkClient(
      failures,
      clients.physicalIos,
      'physicalIos',
      true,
      releaseIdentifier,
    )
  }

  checkProofGroup(
    failures,
    record.controls,
    REQUIRED_CONTROL_PROOFS,
    'controls',
  )
  checkProofGroup(
    failures,
    record.operations,
    REQUIRED_OPERATIONAL_PROOFS,
    'operations',
  )

  if (record.invitationDecision !== 'ready') {
    failures.push('invitationDecision is not ready.')
  }
  if (!completedText(record.decisionOwner)) {
    failures.push('decisionOwner is missing.')
  }
  return failures
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--record') {
    throw new Error(
      'Usage: npm run verify:closed-beta-methodology-readiness -- --record <evidence.json>',
    )
  }
  return path.resolve(argv[1])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const recordPath = parseArguments(process.argv.slice(2))
  const [record, manifest] = await Promise.all([
    readFile(recordPath, 'utf8').then(JSON.parse),
    readFile(defaultManifestPath, 'utf8').then(JSON.parse),
  ])
  const failures = evaluateClosedBetaMethodologyReadiness(record, manifest)
  if (failures.length > 0) {
    const details = failures.map((failure) => `- ${failure}`).join('\n')
    throw new Error(
      `Closed-beta methodology invitation readiness is blocked:\n${details}`,
    )
  }
  console.log(
    `Verified closed-beta methodology invitation readiness from ${path.relative(repositoryRoot, recordPath)}.`,
  )
}
