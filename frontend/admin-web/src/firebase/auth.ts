export interface FirebaseSession {
  uid: string
  email: string
  name: string
  isAdmin: boolean
}

export interface AuthGateway {
  subscribe: (
    next: (session: FirebaseSession | null) => void,
    error: (error: unknown) => void,
  ) => () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<FirebaseSession | null>
}

export function sessionFromClaims(
  user: { uid: string; email: string | null; displayName: string | null },
  claims: Record<string, unknown>,
): FirebaseSession {
  return {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || user.email || 'User',
    isAdmin: claims.admin === true,
  }
}

export const loadAuthGateway = (): Promise<AuthGateway> =>
  import('./client').then((m) => m.authGateway)

export function isAuthModuleLoadError(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
    message,
  )
}

export function authError(error: unknown) {
  if (isAuthModuleLoadError(error)) {
    return 'The sign-in module could not be loaded. Reload this page and try again.'
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const messages: Record<string, string> = {
    'emulator/invalid-config': 'Local Firebase configuration is invalid. Use the local startup script.',
    'profile/unavailable': 'Account initialization failed. Check the Functions service and try again.',
    'functions/permission-denied': 'Account initialization was denied. Your account may be blocked.',
    'functions/unauthenticated': 'Account initialization requires a new sign-in. Sign out and try again.',
    'backend/not-configured': 'The administration server has not been configured.',
    'backend/unavailable':
      'Could not reach the administration server. Check the connection and try again.',
    'backend/access-denied':
      'Administrator access was denied. Your account may be blocked or your access revoked.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
    'auth/operation-not-allowed':
      'Email/password sign-in is disabled. Enable it in Firebase Authentication → Sign-in method.',
    'auth/configuration-not-found':
      'Enable Firebase Authentication and the Email/Password provider in the Firebase Console.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment before trying again.',
    'auth/invalid-api-key': 'Firebase configuration is invalid. Check the Web App configuration.',
    'auth/unauthorized-domain':
      'Add this website domain in Firebase Authentication → Settings → Authorized domains.',
    'auth/user-token-expired': 'Your session has expired. Sign out and sign in again.',
    'auth/web-storage-unsupported':
      'Browser session storage is unavailable. Enable website storage and try again.',
  }
  return messages[code] || 'Firebase authentication could not be completed. Please try again.'
}
