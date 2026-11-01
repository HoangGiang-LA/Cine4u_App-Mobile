import {readFile} from 'node:fs/promises'
import {deleteApp} from 'firebase-admin/app'
import {createAccounts} from '../src/accounts.mjs'
import {assertEmulators, connectLocalFirebase, demoAccounts, demoPassword, signIn, callable} from './local-config.mjs'

await assertEmulators()
const {app, auth, database} = connectLocalFirebase()
try {
  const seed = JSON.parse(await readFile(new URL('../../database/english-battle.seed.json', import.meta.url), 'utf8'))
  const allowed = ['appConfig', 'categories', 'topics', 'lessons', 'lessonQuestions', 'questions',
    'questionVersions', 'questionAnswers', 'contentAssets', 'quizTemplates', 'achievements', 'lookupIndexes', 'adminViews']
  if (Object.keys(seed).some(key => !allowed.includes(key))) throw new Error('Seed contains an unapproved runtime/account root.')
  let added = 0
  for (const root of allowed) {
    for (const [key, value] of Object.entries(seed[root] || {})) {
      const result = await database.ref(`${root}/${key}`).transaction(current => current === null ? value : undefined)
      if (result.committed) added++
    }
  }
  for (const account of demoAccounts) {
    let user
    try { user = await auth.getUser(account.uid) }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error
      user = await auth.createUser({uid: account.uid, email: account.email, password: demoPassword, displayName: account.displayName})
    }
    if (user.email !== account.email || user.disabled) throw new Error(`Demo account ${account.uid} was changed; seed will not overwrite it.`)
    const initialized = await callable('ensureUserProfile', await signIn(account.email))
    if (initialized.status !== 200) throw new Error(`Callable provisioning failed for ${account.uid}: ${initialized.status}`)
    await createAccounts(auth, database).requireActive(account.uid)
    if (account.admin && user.customClaims?.admin !== true) {
      await auth.setCustomUserClaims(account.uid, {...user.customClaims, admin: true})
    }
  }
  console.log(`Seed complete: ${added} missing content entries added. Existing content and runtime data preserved.`)
  console.log('Local-only logins: admin@example.test / learner@example.test; password: LocalDemo123!')
} finally { await deleteApp(app) }
