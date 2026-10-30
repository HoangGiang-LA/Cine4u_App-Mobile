import {connectFirebase} from '../src/firebase.mjs'
import {createAccounts} from '../src/accounts.mjs'

const [action, uid] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !uid || process.argv.length !== 4) {
  throw new Error('Usage: npm run admin -- grant|revoke FIREBASE_UID')
}
const {auth, database} = connectFirebase()
const user = await auth.getUser(uid)
const claims = {...user.customClaims}
if (action === 'grant') {
  if (user.disabled) throw new Error('Cannot grant access to a disabled account.')
  await createAccounts(auth, database).ensure(user)
  claims.admin = true
} else delete claims.admin
await auth.setCustomUserClaims(uid, claims)
console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin access for UID ${uid}. Refresh the sign-in token.`)
process.exit(0)
