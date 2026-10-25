import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FlaskConical, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { Field, FormError } from '../components'
import { validateEmail } from '../lib'
import { firebaseConfig } from './config'
import { authError, loadAuthGateway, type AuthGateway, type FirebaseSession } from './auth'

export function FirebaseSignIn({
  onDemo,
  loadGateway = loadAuthGateway,
}: {
  onDemo: () => void
  loadGateway?: () => Promise<AuthGateway>
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState('')
  const [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<FirebaseSession | null>(null)
  const [revision, setRevision] = useState(0),
    gateway = useRef<AuthGateway | null>(null),
    mounted = useRef(true)
  useEffect(() => {
    let closed = false,
      unsubscribe: (() => void) | undefined
    mounted.current = true
    setChecking(true)
    setError('')
    void loadGateway()
      .then((api) => {
        if (closed) return
        gateway.current = api
        unsubscribe = api.subscribe(
          (value) => {
            if (closed) return
            setSession(value)
            setChecking(false)
            if (value) setPassword('')
          },
          (e) => {
            if (closed) return
            setSession(null)
            setChecking(false)
            setError(authError(e))
          },
        )
      })
      .catch((e) => {
        if (!closed) {
          setChecking(false)
          setError(authError(e))
        }
      })
    return () => {
      closed = true
      mounted.current = false
      gateway.current = null
      unsubscribe?.()
    }
  }, [loadGateway, revision])
  const run = async (action: (api: AuthGateway) => Promise<void>) => {
    if (busy || !gateway.current) return
    setBusy(true)
    setError('')
    try {
      await action(gateway.current)
    } catch (e) {
      if (mounted.current) setError(authError(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const demo = () => {
    if (!session) {
      onDemo()
      return
    }
    void run(async (api) => {
      await api.signOut()
      if (mounted.current) onDemo()
    })
  }
  return (
    <>
      <span className="login-symbol">
        <ShieldCheck size={27} />
      </span>
      <h2>{session ? 'Firebase account connected' : 'Welcome back'}</h2>
      <p>
        {session
          ? 'Authentication is connected. Admin services are the next step.'
          : 'Sign in to your administration workspace.'}
      </p>
      {session ? (
        <section className="firebase-session" aria-label="Firebase account status">
          <div className="firebase-connected">
            <CheckCircle2 size={17} />
            <strong>Signed in to Firebase Authentication</strong>
          </div>
          <dl>
            <div>
              <dt>Account</dt>
              <dd>{session.email || session.name}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>{session.uid}</dd>
            </div>
            <div>
              <dt>Firebase project</dt>
              <dd>{firebaseConfig.projectId}</dd>
            </div>
            <div>
              <dt>Admin claim</dt>
              <dd>{session.isAdmin ? 'Detected in the current token' : 'Not assigned'}</dd>
            </div>
          </dl>
          <p className="info-note">
            {session.isAdmin
              ? 'Your token contains an admin claim. Live management pages still require backend APIs and server-side permission checks.'
              : 'This account does not have an admin claim yet. An administrator must grant access from a trusted server environment.'}
          </p>
          <p className="firebase-status-note">
            Realtime Database is configured. Data access has not been tested; no database records
            are read or changed on this screen.
          </p>
          <div className="firebase-session-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                void run(async (api) => {
                  const refreshed = await api.refresh()
                  if (mounted.current) setSession(refreshed)
                })
              }
            >
              <RefreshCw size={14} />
              Refresh access
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void run((api) => api.signOut())}
            >
              <LogOut size={14} />
              Sign out of Firebase
            </button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!validateEmail(email.trim())) {
              setError('Enter a valid email address.')
              return
            }
            if (password.length < 6) {
              setError('Enter a password of at least 6 characters.')
              return
            }
            void run(async (api) => {
              try {
                await api.signIn(email, password)
              } finally {
                if (mounted.current) setPassword('')
              }
            })
          }}
        >
          <Field label="Email address">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={busy}
            />
          </Field>
          <FormError error={error} />
          <button
            className="btn btn-primary full-width"
            type="submit"
            disabled={checking || busy || !gateway.current}
          >
            {checking ? 'Checking Firebase session…' : busy ? 'Signing in…' : 'Sign in'}
          </button>
          {!checking && !gateway.current && (
            <button type="button" className="text-btn" onClick={() => setRevision((r) => r + 1)}>
              Retry Firebase setup
            </button>
          )}
        </form>
      )}
      {session && <FormError error={error} />}
      <div className="login-divider">
        <span>PREVIEW THE FRONTEND</span>
      </div>
      <button className="btn full-width" disabled={busy || checking} onClick={demo}>
        <FlaskConical size={16} />
        Open demo workspace
      </button>
      <p className="login-note">
        Demo access uses local sample data. No Firebase account is created and nothing is sent to
        your database.
        {session ? ' Entering the demo signs out of your Firebase session in this browser.' : ''}
      </p>
    </>
  )
}
