import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import type {
  AccountDeletionRequestAcceptedResult,
  MaterialCommandResult,
} from '../domain/materialCommands/contract'
import {
  reauthenticateForAccountDeletion,
  resolveAccountDeletionRequest,
  submitAccountDeletionRequest,
} from '../services/accountDeletionService'

type RequestPhase = 'idle' | 'reauthenticating' | 'submitting' | 'resolving'

interface AccountDeletionFailure {
  kind: 'definitive' | 'outcome_unknown'
  message: string
}

export interface AccountDeletionDialogProps {
  email: string | null
  supportEmail: string
  unresolvedCommandId: string | null
  onAccepted: (receipt: AccountDeletionRequestAcceptedResult) => void
  onClose: () => void
  onUnresolvedCommandChange: (commandId: string | null) => void
}

export interface AccountDeletionReceiptProps {
  receipt: AccountDeletionRequestAcceptedResult
  supportEmail: string
  signedOut: boolean
  signOutError: string | null
  onRetrySignOut: () => void
  onDone: () => void
}

function createCommandId(): string {
  return `account-delete-${globalThis.crypto.randomUUID()}`
}

function failureFor(result: MaterialCommandResult): AccountDeletionFailure {
  if (result.status === 'authentication_error') {
    if (result.code === 'recent-authentication-required') {
      return {
        kind: 'definitive',
        message:
          'Marathoner could not confirm a recent sign-in. Re-enter your password and try again.',
      }
    }
    if (result.code === 'verified-email-required') {
      return {
        kind: 'definitive',
        message:
          'Verify the email address on this account before requesting deletion.',
      }
    }
    return {
      kind: 'definitive',
      message: 'Your session ended. Sign in again before requesting deletion.',
    }
  }

  if (result.status === 'authorization_error') {
    if (result.code === 'approved-beta-membership-required') {
      return {
        kind: 'definitive',
        message:
          'This account is not currently approved for the Marathoner beta. Contact support for private deletion help.',
      }
    }
    return {
      kind: 'definitive',
      message:
        'Marathoner could not verify this app session. Refresh or reopen the supported app before trying again.',
    }
  }

  if (result.status === 'retryable_error') {
    return {
      kind: 'definitive',
      message: result.message,
    }
  }

  if (result.status === 'outcome_unknown') {
    return {
      kind: 'outcome_unknown',
      message:
        'Marathoner could not confirm whether the request was accepted. Check this same request before trying another one.',
    }
  }

  if (result.status === 'unsupported_version') {
    return {
      kind: 'definitive',
      message:
        'Update Marathoner before requesting deletion. Your account has not been changed.',
    }
  }

  return {
    kind: 'definitive',
    message:
      'Marathoner could not safely accept this deletion request. Contact support before trying again.',
  }
}

function reauthenticationFailure(error: unknown): AccountDeletionFailure {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'network_unavailable'
  ) {
    return {
      kind: 'definitive',
      message:
        'You are offline. This deletion request was not saved or queued; reconnect and try again.',
    }
  }

  return {
    kind: 'definitive',
    message:
      error instanceof Error
        ? error.message
        : 'Marathoner could not verify your password. Please try again.',
  }
}

export function AccountDeletionDialog({
  email,
  supportEmail,
  unresolvedCommandId,
  onAccepted,
  onClose,
  onUnresolvedCommandChange,
}: AccountDeletionDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const failureRef = useRef<HTMLParagraphElement>(null)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<RequestPhase>('idle')
  const [commandId, setCommandId] = useState<string | null>(
    unresolvedCommandId,
  )
  const [failure, setFailure] = useState<AccountDeletionFailure | null>(
    unresolvedCommandId
      ? {
          kind: 'outcome_unknown',
          message:
            'This request still needs to be checked before Marathoner can offer another deletion request.',
        }
      : null,
  )
  const pending = phase !== 'idle'

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    if (failure) failureRef.current?.focus()
  }, [failure])

  const accept = (result: MaterialCommandResult): boolean => {
    if (result.status !== 'accepted') return false
    onUnresolvedCommandChange(null)
    onAccepted(result)
    return true
  }

  const preserveUnknownOutcome = (originalCommandId: string, message: string) => {
    setCommandId(originalCommandId)
    onUnresolvedCommandChange(originalCommandId)
    setFailure({ kind: 'outcome_unknown', message })
  }

  const resolveOriginalCommand = async (originalCommandId: string) => {
    setPhase('resolving')
    setFailure(null)

    try {
      const resolved = await resolveAccountDeletionRequest(originalCommandId)
      if (accept(resolved)) return
      preserveUnknownOutcome(
        originalCommandId,
        'The original request still cannot be confirmed. No new request was sent. Reconnect and check this request again, or contact support.',
      )
    } catch {
      preserveUnknownOutcome(
        originalCommandId,
        'The original request still cannot be confirmed. No new request was sent. Reconnect and check this request again, or contact support.',
      )
    } finally {
      setPhase('idle')
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || password.length === 0) return

    setFailure(null)
    setPhase('reauthenticating')

    try {
      await reauthenticateForAccountDeletion(password)
    } catch (error) {
      setFailure(reauthenticationFailure(error))
      setPhase('idle')
      return
    } finally {
      setPassword('')
    }

    const currentCommandId = commandId ?? createCommandId()
    setCommandId(currentCommandId)
    setPhase('submitting')

    try {
      const result = await submitAccountDeletionRequest(currentCommandId)
      if (accept(result)) return
      if (result.status === 'outcome_unknown') {
        onUnresolvedCommandChange(currentCommandId)
        await resolveOriginalCommand(currentCommandId)
        return
      }
      setFailure(failureFor(result))
    } catch {
      preserveUnknownOutcome(
        currentCommandId,
        'Marathoner could not confirm whether the request was accepted. Check this same request before trying another one.',
      )
    } finally {
      setPhase('idle')
    }
  }

  const statusMessage =
    phase === 'reauthenticating'
      ? 'Confirming your password...'
      : phase === 'submitting'
        ? 'Sending this deletion request...'
        : phase === 'resolving'
          ? 'Checking the original request...'
          : null

  return (
    <div
      className="account-settings-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) onClose()
      }}
    >
      <section
        className="account-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-heading"
      >
        <div className="account-settings-header">
          <div>
            <p className="account-settings-eyebrow">Account settings</p>
            <h2 id="account-settings-heading" ref={headingRef} tabIndex={-1}>
              Delete your Marathoner account
            </h2>
          </div>
          <button
            type="button"
            className="account-settings-close"
            aria-label="Close account settings"
            disabled={pending}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p>
          This request permanently deletes your account, runner profile,
          training plans, workouts, runs, shoes, and beta access.
        </p>
        <ul className="account-deletion-facts">
          <li>Access stops as soon as the request is accepted.</li>
          <li>Deletion may take up to seven calendar days to finish.</li>
          <li>This action cannot be undone.</li>
        </ul>
        <p>
          If you need private help, email{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. After acceptance,
          include the non-identifying request ID shown by Marathoner.
        </p>

        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="account-deletion-password">
            Re-enter the password for {email ?? 'this account'}
          </label>
          <input
            id="account-deletion-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={pending || failure?.kind === 'outcome_unknown'}
            onChange={(event) => setPassword(event.target.value)}
          />

          {statusMessage && (
            <p className="account-deletion-status" role="status">
              {statusMessage}
            </p>
          )}
          {failure && (
            <p
              ref={failureRef}
              className="account-deletion-error"
              role="alert"
              tabIndex={-1}
            >
              {failure.message}
            </p>
          )}

          {failure?.kind === 'outcome_unknown' ? (
            <button
              type="button"
              className="account-deletion-resolve"
              disabled={pending || commandId === null}
              onClick={() => {
                if (commandId) void resolveOriginalCommand(commandId)
              }}
            >
              Check the original request
            </button>
          ) : (
            <button
              type="submit"
              className="account-deletion-submit"
              disabled={pending || password.length === 0}
              aria-label="Permanently delete my Marathoner account"
            >
              Permanently delete my Marathoner account
            </button>
          )}
        </form>
      </section>
    </div>
  )
}

export function AccountDeletionReceipt({
  receipt,
  supportEmail,
  signedOut,
  signOutError,
  onRetrySignOut,
  onDone,
}: AccountDeletionReceiptProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const completionDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }).format(new Date(receipt.completionDueAt))

  const copyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(receipt.requestId)
      setCopyStatus('Request ID copied.')
    } catch {
      setCopyStatus('Select and copy the request ID below.')
    }
  }

  return (
    <section
      className="account-deletion-receipt"
      aria-labelledby="account-deletion-receipt-heading"
    >
      <p className="account-settings-eyebrow">Request accepted</p>
      <h1 id="account-deletion-receipt-heading">
        Your deletion request is pending
      </h1>
      <p>
        Marathoner accepted your request and stopped account access. Deletion is
        not complete yet and may take until <strong>{completionDate}</strong>.
      </p>
      <div className="account-deletion-request-id">
        <span>Request ID</span>
        <code>{receipt.requestId}</code>
        <button type="button" onClick={() => void copyRequestId()}>
          Copy request ID
        </button>
      </div>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <p>
        Keep this ID. For private help, email{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and include it.
      </p>

      {!signedOut && !signOutError && (
        <p role="status">Clearing this session and signing you out...</p>
      )}
      {signOutError && (
        <div className="account-deletion-signout-error" role="alert">
          <p>{signOutError}</p>
          <button type="button" onClick={onRetrySignOut}>
            Try signing out again
          </button>
        </div>
      )}
      {signedOut && (
        <button type="button" className="account-deletion-done" onClick={onDone}>
          Return to sign in
        </button>
      )}
    </section>
  )
}
