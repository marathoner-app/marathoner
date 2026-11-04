import { useEffect, useState } from 'react'

import type {
  GarminConnectionStatus,
  GarminConnectionStatusResult,
  GarminDisconnectResult,
  GarminStartResult,
} from '../domain/garminConnection/contract'
import {
  systemExternalAuthorizationLauncher,
} from '../services/externalAuthorizationLauncher'
import type { ExternalAuthorizationLauncher } from '../services/externalAuthorizationLauncher'
import {
  firebaseGarminConnectionClient,
} from '../services/firebaseGarminConnectionClient'
import type { GarminConnectionClient } from '../services/garminConnectionClient'

interface GarminConnectionProps {
  accountScope: string
  authorizationLauncher?: ExternalAuthorizationLauncher
  client?: GarminConnectionClient
}

type PendingOperation = 'start' | 'refresh' | 'disconnect' | null

type GarminDisconnectFailure = Readonly<{
  status: 'authentication_error' | 'authorization_error' | 'unavailable'
  code:
    | 'authentication-required'
    | 'app-check-required'
    | 'provider-revocation-failed'
    | 'garmin-oauth-disabled'
}>

type GarminConnectionFailure =
  | Exclude<GarminStartResult, { status: 'ready' }>
  | GarminDisconnectFailure

function isConnectionStatus(
  result: GarminConnectionStatusResult,
): result is GarminConnectionStatus {
  return (
    result.status === 'connected' ||
    result.status === 'disconnected' ||
    result.status === 'disconnecting'
  )
}

function isDisconnectFailure(
  result: GarminDisconnectResult,
): result is GarminDisconnectFailure {
  return (
    result.status === 'authentication_error' ||
    result.status === 'authorization_error' ||
    result.status === 'unavailable'
  )
}

function connectionFailure(result: GarminConnectionFailure): string {
  if (result.status === 'authentication_error') {
    return 'Your session ended. Sign in again before changing Garmin access.'
  }
  if (result.status === 'authorization_error') {
    return result.code === 'approved-beta-membership-required'
      ? 'This account is not currently approved for the Marathoner beta.'
      : 'Marathoner could not verify this app session. Refresh or reopen Marathoner and try again.'
  }
  if (result.code === 'provider-revocation-failed') {
    return 'Garmin is still being disconnected. Try again to finish removing access.'
  }
  return 'Garmin connection is not available in this build yet.'
}

function connectedDate(value: string | null): string | null {
  if (value === null) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

export default function GarminConnection({
  accountScope,
  authorizationLauncher = systemExternalAuthorizationLauncher,
  client = firebaseGarminConnectionClient,
}: GarminConnectionProps) {
  const [connection, setConnection] = useState<GarminConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingOperation>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const applyStatus = (result: GarminConnectionStatusResult) => {
    if (isConnectionStatus(result)) {
      setConnection(result)
      setUnavailable(false)
      return
    }
    setConnection(null)
    const isDisabled = result.code === 'garmin-oauth-disabled'
    setUnavailable(isDisabled)
    setError(isDisabled ? null : connectionFailure(result))
  }

  const refresh = async (afterAuthorization = false) => {
    setPending('refresh')
    setError(null)
    try {
      const result = await client.getStatus()
      applyStatus(result)
      if (result.status === 'connected') {
        setMessage('Garmin is connected. New completed runs will arrive automatically.')
      } else if (afterAuthorization && result.status === 'disconnected') {
        setMessage(
          'Garmin is not connected yet. Finish approval in the Garmin tab, then check again.',
        )
      }
    } catch {
      setError('Marathoner could not check Garmin right now. Try again shortly.')
    } finally {
      setPending(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setConnection(null)
    setUnavailable(false)
    setMessage(null)
    setError(null)
    void client
      .getStatus()
      .then((result) => {
        if (active) applyStatus(result)
      })
      .catch(() => {
        if (active) {
          setError('Marathoner could not check Garmin right now. Try again shortly.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountScope, client])

  const start = async () => {
    const authorizationTarget = authorizationLauncher.prepare()
    if (authorizationTarget === null) {
      setError('Allow Marathoner to open a new tab, then try connecting Garmin again.')
      return
    }
    setPending('start')
    setMessage(null)
    setError(null)
    try {
      const result = await client.start()
      if (result.status !== 'ready') {
        authorizationTarget.cancel()
        setError(connectionFailure(result))
        return
      }
      await authorizationTarget.open(result.authorizationUrl)
      setMessage(
        'Garmin opened for approval. After approving access, return here and check the connection.',
      )
    } catch {
      authorizationTarget.cancel()
      setError('Marathoner could not open Garmin approval. Try again shortly.')
    } finally {
      setPending(null)
    }
  }

  const disconnect = async () => {
    setPending('disconnect')
    setMessage(null)
    setError(null)
    try {
      const result = await client.disconnect()
      if (result.status === 'disconnected') {
        setConnection({ status: 'disconnected', connectedAt: null })
        setMessage('Garmin access has been removed from Marathoner.')
      } else if (result.status === 'pending') {
        setConnection({
          status: 'disconnecting',
          connectedAt: connection?.connectedAt ?? null,
        })
        setMessage('Garmin is still being disconnected. You can finish this safely here.')
      } else if (isDisconnectFailure(result)) {
        setError(connectionFailure(result))
        if (result.code === 'provider-revocation-failed') {
          setConnection({
            status: 'disconnecting',
            connectedAt: connection?.connectedAt ?? null,
          })
        }
      }
    } catch {
      setError('Marathoner could not finish disconnecting Garmin. Try again shortly.')
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null
  const date = connectedDate(connection?.connectedAt ?? null)

  return (
    <section className="garmin-connection-section" aria-labelledby="garmin-heading">
      <h3 id="garmin-heading">Garmin Connect runs</h3>
      {loading ? (
        <p role="status">Checking Garmin...</p>
      ) : unavailable ? (
        <p>Direct Garmin import is not available in this build yet.</p>
      ) : connection?.status === 'connected' ? (
        <>
          <p>
            Garmin is connected{date ? ` since ${date}` : ''}. Completed running
            activities will appear in Track automatically.
          </p>
          <details className="garmin-recovery">
            <summary>A run is missing</summary>
            <p>
              Garmin may take a little time to finish a workout. Wait a few
              minutes and check Track again before logging it yourself, which
              could create a duplicate.
            </p>
            <p>
              If runs continue to be missing, reconnect Garmin. Existing runs
              stay in Marathoner while the connection is replaced.
            </p>
            <button type="button" disabled={busy} onClick={() => void start()}>
              {pending === 'start' ? 'Opening Garmin...' : 'Reconnect Garmin'}
            </button>
          </details>
          <div className="garmin-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              {pending === 'refresh' ? 'Checking connection...' : 'Check connection'}
            </button>
            <button
              type="button"
              className="garmin-disconnect"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {pending === 'disconnect' ? 'Disconnecting Garmin...' : 'Disconnect Garmin'}
            </button>
          </div>
        </>
      ) : connection?.status === 'disconnecting' ? (
        <>
          <p>
            Garmin access is being removed. New Garmin runs will not be added
            while this finishes.
          </p>
          <button type="button" disabled={busy} onClick={() => void disconnect()}>
            {pending === 'disconnect' ? 'Finishing disconnect...' : 'Finish disconnecting Garmin'}
          </button>
        </>
      ) : (
        <>
          <p>
            Connect Garmin to add completed running activities automatically.
            Marathoner receives workout time, duration, and distance. It does
            not import routes or all-day health data.
          </p>
          <button
            type="button"
            className="garmin-primary"
            disabled={busy}
            onClick={() => void start()}
          >
            {pending === 'start' ? 'Opening Garmin...' : 'Connect Garmin'}
          </button>
          {message?.includes('Garmin opened') && (
            <button
              type="button"
              className="garmin-check-after-authorization"
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              {pending === 'refresh' ? 'Checking connection...' : 'Check connection'}
            </button>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="garmin-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
