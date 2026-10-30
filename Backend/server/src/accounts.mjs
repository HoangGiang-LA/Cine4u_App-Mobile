export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message)
    this.status = status
    this.details = details
  }
}

function checkStatus(value) {
  if (value !== null && value?.status !== 'active') {
    throw new ApiError('PERMISSION_DENIED', 'Account access is blocked.', {
      reason: value?.status === 'deleted' ? 'account-deleted' : 'account-banned',
    })
  }
}

export function createAccounts(auth, database) {
  const initializations = new Map()
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
    if (!snapshot.exists()) throw new ApiError('FAILED_PRECONDITION', 'Initialize the account first.')
    checkStatus(snapshot.val())
  }

  async function provision(user) {
    const uid = user.uid
    const accessRef = database.ref(`accountAccess/${uid}`)
    checkStatus((await accessRef.get()).val())
    const now = Date.now()
    const displayName = user.displayName?.trim().slice(0, 50) || 'Người học'
    const createdAt = Date.parse(user.metadata.creationTime) || now
    const defaults = {
      users: {displayCode: `U-${uid}`, displayName, avatarKey: 'default_01', createdAt, updatedAt: now},
      userSettings: {notificationsEnabled: true, soundVolume: 0.7, language: 'vi', theme: 'light', updatedAt: now},
      userStats: {rating: 0, matchesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0, updatedAt: now},
      wallets: {coinBalance: 0, updatedAt: now},
    }
    // Per-record transactions preserve existing balances/progress during retries.
    await Promise.all(Object.entries(defaults).map(([path, value]) =>
      database.ref(`${path}/${uid}`).transaction(current => current === null ? value : undefined)))
    // Identity comes from Firebase Auth, never a UID/email/role supplied by a client.
    await database.ref(`userPrivate/${uid}`).update({
      email: user.email || '', emailVerified: user.emailVerified,
      authProviders: Object.fromEntries(user.providerData.map(p => [p.providerId.replaceAll('.', '_'), true])),
      updatedAt: now,
    })
    if (user.displayName) await database.ref(`users/${uid}`).update({displayName, updatedAt: now})
    // Enable access last. Never overwrite a concurrent ban or account deletion.
    const result = await accessRef.transaction(current =>
      current === null ? {status: 'active', updatedAt: now} : undefined)
    checkStatus(result.snapshot.val())
    await requireActive(uid)
  }

  async function ensure(user) {
    // Share concurrent requests for one UID; transactions still protect other servers.
    let operation = initializations.get(user.uid)
    if (!operation) {
      operation = provision(user)
      initializations.set(user.uid, operation)
    }
    try { await operation } finally {
      if (initializations.get(user.uid) === operation) initializations.delete(user.uid)
    }
  }

  async function execute(method, data, identity) {
    const {user, decoded} = identity
    if (method === 'ensureUserProfile' || method === 'getAdminSession') {
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length) {
        throw new ApiError('INVALID_ARGUMENT', 'This method accepts no fields.')
      }
      if (method === 'getAdminSession' && (decoded.admin !== true || user.customClaims?.admin !== true)) {
        throw new ApiError('PERMISSION_DENIED', 'Administrator access required.', {reason: 'admin-required'})
      }
      await ensure(user)
      return method === 'ensureUserProfile' ? {serverNow: Date.now()} : {
        serverNow: Date.now(), uid: user.uid, role: 'admin',
        displayName: user.displayName || user.email || 'Administrator',
      }
    }
    await requireActive(user.uid)
    if (method.startsWith('admin') && (decoded.admin !== true || user.customClaims?.admin !== true)) {
      throw new ApiError('PERMISSION_DENIED', 'Administrator access required.', {reason: 'admin-required'})
    }
    throw new ApiError('UNIMPLEMENTED', 'This feature is not implemented yet.')
  }

  return {authenticate, execute, ensure, requireActive}
}
