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
    render(<FirebaseSignIn loadGateway={loadGateway} onDemo={() => {}} />)
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
  it('restores a signed-in session without opening a demo or live admin workspace', async () => {
    const auth = createAuthStub(session),
      onDemo = vi.fn()
    render(<FirebaseSignIn loadGateway={auth.load} onDemo={onDemo} />)
    await screen.findByRole('heading', { name: 'Firebase account connected' })
    expect(screen.getByText('Not assigned')).toBeVisible()
    expect(screen.getByText('test@example.test')).toBeVisible()
    expect(screen.getByText(/Data access has not been tested/)).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(onDemo).not.toHaveBeenCalled()
  })
  it('signs in through the gateway, clears the password and refreshes permission claims', async () => {
    const auth = createAuthStub(),
      user = userEvent.setup()
    vi.mocked(auth.gateway.signIn).mockImplementation(async () => {
      auth.emit(session)
    })
    render(<FirebaseSignIn loadGateway={auth.load} onDemo={() => {}} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), session.email)
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Firebase account connected' })
    expect(auth.gateway.signIn).toHaveBeenCalledWith(session.email, 'not-a-real-password')
    vi.mocked(auth.gateway.refresh).mockResolvedValue({ ...session, isAdmin: true })
    await user.click(screen.getByRole('button', { name: 'Refresh access' }))
    await screen.findByText('Detected in the current token')
    expect(screen.getByText(/Live management pages still require backend APIs/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sign out of Firebase' }))
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
  it('maps provider errors and never persists the password in app storage', async () => {
    const auth = createAuthStub(),
      user = userEvent.setup()
    vi.mocked(auth.gateway.signIn).mockRejectedValue({ code: 'auth/operation-not-allowed' })
    render(<FirebaseSignIn loadGateway={auth.load} onDemo={() => {}} />)
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
  it('signs out of Firebase before entering demo and does not continue if sign-out fails', async () => {
    const auth = createAuthStub(session),
      user = userEvent.setup(),
      onDemo = vi.fn()
    render(<FirebaseSignIn loadGateway={auth.load} onDemo={onDemo} />)
    await screen.findByRole('heading', { name: 'Firebase account connected' })
    vi.mocked(auth.gateway.signOut).mockRejectedValueOnce({ code: 'auth/network-request-failed' })
    await user.click(screen.getByRole('button', { name: 'Open demo workspace' }))
    await screen.findByRole('alert')
    expect(onDemo).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Open demo workspace' }))
    await waitFor(() => expect(onDemo).toHaveBeenCalledTimes(1))
    expect(auth.gateway.signOut).toHaveBeenCalledTimes(2)
  })
  it('returns to sign-in when the session ends and allows demo when SDK setup fails', async () => {
    const auth = createAuthStub(session),
      user = userEvent.setup(),
      onDemo = vi.fn()
    const rendered = render(<FirebaseSignIn loadGateway={auth.load} onDemo={onDemo} />)
    await screen.findByRole('heading', { name: 'Firebase account connected' })
    act(() => auth.emit(null))
    await screen.findByRole('heading', { name: 'Welcome back' })
    rendered.unmount()
    render(
      <FirebaseSignIn
        loadGateway={() => Promise.reject(new Error('SDK unavailable'))}
        onDemo={onDemo}
      />,
    )
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Open demo workspace' }))
    expect(onDemo).toHaveBeenCalledTimes(1)
  })
})
