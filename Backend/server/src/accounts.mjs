export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message)
    this.status = status
    this.details = details
  }
}

/** Read-only authorization. Only the BE1 Callable provisions account records. */
export function createAccounts(auth, database) {
  async function authenticate(token) {
    try {
      const decoded = await auth.verifyIdToken(token, true)
      const user = await auth.getUser(decoded.uid)
      if (user.disabled) throw new ApiError('PERMISSION_DENIED', 'Account is disabled.', {reason: 'account-banned'})
      return {decoded, user}
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error.code === 'auth/user-disabled') {
        throw new ApiError('PERMISSION_DENIED', 'Account is disabled.', {reason: 'account-banned'})
      }
      if (typeof error.code === 'string' && error.code.startsWith('auth/')) {
        throw new ApiError('UNAUTHENTICATED', 'Sign in again.')
      }
      throw error
    }
  }

  async function requireActive(uid) {
    const snapshot = await database.ref(`accountAccess/${uid}`).get()
    if (!snapshot.exists()) throw new ApiError('FAILED_PRECONDITION', 'Initialize the account through the BE1 Callable first.')
    const access = snapshot.val()
    if (access?.status !== 'active') {
      throw new ApiError('PERMISSION_DENIED', 'Account access is blocked.', {
        reason: access?.status === 'deleted' ? 'account-deleted' : 'account-banned',
      })
    }
  }

  async function execute(method, data, {user, decoded}) {
    // Deliberately do not expose ensureUserProfile or any learning/admin business API.
    if (method !== 'getAdminSession') throw new ApiError('NOT_FOUND', 'Endpoint not found.')
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length) {
      throw new ApiError('INVALID_ARGUMENT', 'This method accepts no fields.')
    }
    if (decoded.admin !== true || user.customClaims?.admin !== true) {
      throw new ApiError('PERMISSION_DENIED', 'Administrator access required.', {reason: 'admin-required'})
    }
    await requireActive(user.uid)
    return {serverNow: Date.now(), uid: user.uid, role: 'admin',
      displayName: user.displayName || user.email || 'Administrator'}
  }

  return {authenticate, execute, requireActive}
}
