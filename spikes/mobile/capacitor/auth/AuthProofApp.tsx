import { useState } from 'react'
import { useAuth } from '../../../../src/auth/useAuth'
import LoginButton from '../../../../src/components/LoginButton'
import './auth-proof.css'

export default function AuthProofApp() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const handleLogout = async () => {
    setLogoutError(null)

    try {
      await auth.logout()
    } catch {
      setLogoutError("We couldn't log you out. Please try again.")
    }
  }

  return (
    <main className="mobile-auth-proof">
      <p className="mobile-auth-eyebrow">ISSUE #86 · IOS AUTH PROOF</p>
      <h1>Marathoner</h1>
      <p className="mobile-auth-subtitle">Capacitor + Firebase JS candidate</p>

      <section className="mobile-auth-card" aria-labelledby="auth-state-title">
        <h2 id="auth-state-title">Authentication state</h2>

        {auth.status === 'loading' && (
          <p role="status">Loading your session...</p>
        )}

        {auth.status === 'signedOut' && (
          <>
            <p>Signed out. Use an existing development account.</p>
            <LoginButton />
          </>
        )}

        {auth.status === 'signedIn' && (
          <>
            <p className="mobile-auth-success">Signed in</p>
            <p>{auth.user.email ?? 'Marathoner test account'}</p>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}

        {logoutError && (
          <p className="mobile-auth-error" role="alert">
            {logoutError}
          </p>
        )}
      </section>

      <p className="mobile-auth-footer">
        Development authentication only. No training or beta data.
      </p>
    </main>
  )
}
