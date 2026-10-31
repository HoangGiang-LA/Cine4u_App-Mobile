import { useEffect, useState } from 'react'
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { Field, FormError } from '../components'
import { validateEmail } from '../lib'
import type { AuthGateway } from './auth'
import { useAdminAuth, type AdminAuthController } from './useAdminAuth'

export function FirebaseSignIn({ loadGateway }: { loadGateway?: () => Promise<AuthGateway> }) {
  const auth = useAdminAuth(loadGateway)
  return <SignInForm auth={auth} />
}

export function SignInForm({ auth }: { auth: AdminAuthController }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const { session, busy, checking } = auth
  useEffect(() => {
    if (session) setPassword('')
  }, [session])

  return (
    <>
      <span className="login-symbol">
        <ShieldCheck size={27} />
      </span>
      <h2>
        {session
          ? session.isAdmin
            ? 'Administrator access verified'
            : 'Administrator access required'
          : 'Welcome back'}
      </h2>
      <p>
        {session
          ? session.isAdmin
            ? 'Opening your administration workspace.'
            : 'This account cannot open the administration workspace.'
          : 'Sign in to your administration workspace.'}
      </p>
      {session ? (
        <section className="firebase-session" aria-label="Account access">
          <p>
            Signed in as <strong>{session.email || session.name}</strong>.
          </p>
          {!session.isAdmin && (
            <p className="info-note">This account does not have administrator access.</p>
          )}
          <div className="firebase-session-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void auth.refresh()}
            >
              <RefreshCw size={14} /> Refresh access
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void auth.signOut()}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!validateEmail(email.trim())) {
              setValidationError('Enter a valid email address.')
              return
            }
            if (password.length < 6) {
              setValidationError('Enter a password of at least 6 characters.')
              return
            }
            setValidationError('')
            try {
              await auth.signIn(email, password)
            } finally {
              setPassword('')
            }
          }}
        >
          <Field label="Email address">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={busy}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              disabled={busy}
            />
          </Field>
          <FormError error={validationError || auth.error} />
          <button
            className="btn btn-primary full-width"
            type="submit"
            disabled={checking || busy || !auth.ready}
          >
            {checking ? 'Checking Firebase session…' : busy ? 'Signing in…' : 'Sign in'}
          </button>
          {!checking && !auth.ready && (
            <button type="button" className="text-btn" onClick={auth.retrySetup}>
              {auth.reloadRequired ? 'Reload page' : 'Retry Firebase setup'}
            </button>
          )}
        </form>
      )}
      {session && <FormError error={auth.error} />}
    </>
  )
}
