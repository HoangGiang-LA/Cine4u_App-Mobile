import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FirebaseSignIn } from '../firebase/SignIn'
import { authError, sessionFromClaims, type FirebaseSession } from '../firebase/auth'
import { firebaseConfig } from '../firebase/config'
import { createAuthStub } from './auth-stub'

const session: FirebaseSession = {
  uid: 'test-uid',
  email: 'test@example.test',
  name: 'Test User',
  isAdmin: false,
}

describe('Firebase Web configuration and sign-in', () => {
  it('explains a failed sign-in module import and offers a page reload', async () => {
    const loadGateway = async () => {
      throw new TypeError(
        'Failed to fetch dynamically imported module: http://localhost/src/firebase/client.ts',
      )
    }
    render(<FirebaseSignIn loadGateway={loadGateway} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Reload this page')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
  it('preserves typed credentials when an initially signed-out session finishes loading', async () => {
    const auth = createAuthStub(),
      user = userEvent.setup()
    let publishInitial: (() => void) | undefined
    const loadGateway = async () => ({
      ...auth.gateway,
      subscribe: (next: (value: FirebaseSession | null) => void) => {
        publishInitial = () => next(null)
        return () => {}
      },
    })
    render(<FirebaseSignIn loadGateway={loadGateway} />)
    await user.type(screen.getByLabelText('Email address'), session.email)
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    act(() => publishInitial?.())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    expect(screen.getByLabelText('Password')).toHaveValue('not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    expect(auth.gateway.signIn).toHaveBeenCalledWith(session.email, 'not-a-real-password')
  })
  it('uses the provided Web App in the existing project and only accepts a boolean admin claim', () => {
    expect(firebaseConfig.projectId).toBe('englishbattleapp-8d764')
    expect(firebaseConfig.appId).toBe('1:1052524880202:web:705ddeba488ad278fb21b3')
    expect(firebaseConfig.databaseURL).toContain('asia-southeast1.firebasedatabase.app')
    const user = { uid: 'u', email: 'test@example.test', displayName: null }
    expect(sessionFromClaims(user, { admin: 'true' }).isAdmin).toBe(false)
    expect(sessionFromClaims(user, { admin: true }).isAdmin).toBe(true)
    expect(sessionFromClaims(user, {}).isAdmin).toBe(false)
  })
  it('keeps a restored non-admin account outside the workspace', async () => {
    const auth = createAuthStub(session)
    render(<FirebaseSignIn loadGateway={auth.load} />)
    await screen.findByRole('heading', { name: 'Administrator access required' })
    expect(screen.getByText('test@example.test')).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open demo workspace' })).not.toBeInTheDocument()
  })
  it('signs in through the gateway, clears the password and refreshes permission claims', async () => {
    const auth = createAuthStub(),
      user = userEvent.setup()
    vi.mocked(auth.gateway.signIn).mockImplementation(async () => {
      auth.emit(session)
    })
    render(<FirebaseSignIn loadGateway={auth.load} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), session.email)
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Administrator access required' })
    expect(auth.gateway.signIn).toHaveBeenCalledWith(session.email, 'not-a-real-password')
    vi.mocked(auth.gateway.refresh).mockResolvedValue({ ...session, isAdmin: true })
    await user.click(screen.getByRole('button', { name: 'Refresh access' }))
    await screen.findByRole('heading', { name: 'Administrator access verified' })
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
  it('maps provider errors and never persists the password in app storage', async () => {
    const auth = createAuthStub(),
      user = userEvent.setup()
    vi.mocked(auth.gateway.signIn).mockRejectedValue({ code: 'auth/operation-not-allowed' })
    render(<FirebaseSignIn loadGateway={auth.load} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), session.email)
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Enable it in Firebase Authentication')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(JSON.stringify(localStorage)).not.toContain('not-a-real-password')
    expect(JSON.stringify(sessionStorage)).not.toContain('not-a-real-password')
    expect(authError({ code: 'auth/network-request-failed' })).toContain('connection')
  })
  it('keeps the session on sign-out failure and allows retry', async () => {
    const auth = createAuthStub(session),
      user = userEvent.setup()
    render(<FirebaseSignIn loadGateway={auth.load} />)
    await screen.findByRole('heading', { name: 'Administrator access required' })
    vi.mocked(auth.gateway.signOut).mockRejectedValueOnce({ code: 'auth/network-request-failed' })
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(auth.gateway.signOut).toHaveBeenCalledTimes(2)
  })
  it('returns to sign-in when the session ends and has no preview bypass on SDK failure', async () => {
    const auth = createAuthStub(session)
    const rendered = render(<FirebaseSignIn loadGateway={auth.load} />)
    await screen.findByRole('heading', { name: 'Administrator access required' })
    act(() => auth.emit(null))
    await screen.findByRole('heading', { name: 'Welcome back' })
    rendered.unmount()
    render(<FirebaseSignIn loadGateway={() => Promise.reject(new Error('SDK unavailable'))} />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Open demo workspace' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})
