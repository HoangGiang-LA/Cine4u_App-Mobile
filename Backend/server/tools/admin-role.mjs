import {deleteApp} from 'firebase-admin/app'
import {connectFirebase} from '../src/firebase.mjs'
import {createAccounts} from '../src/accounts.mjs'

const [action, uid] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !uid || process.argv.length !== 4) {
  throw new Error('Usage: npm run admin -- grant|revoke FIREBASE_UID')
}
const {app, auth, database} = connectFirebase()
try {
  const user = await auth.getUser(uid)
  const claims = {...user.customClaims}
  if (action === 'grant') {
    if (user.disabled) throw new Error('Cannot grant access to a disabled account.')
    await createAccounts(auth, database).requireActive(uid)
    claims.admin = true
  } else delete claims.admin
  await auth.setCustomUserClaims(uid, claims)
  console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin access. Refresh the sign-in token.`)
} finally {
  await deleteApp(app)
}
