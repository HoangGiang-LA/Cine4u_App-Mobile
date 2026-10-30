import {mkdir, writeFile} from 'node:fs/promises'
import {deleteApp} from 'firebase-admin/app'
import {connectFirebase} from '../src/firebase.mjs'

const [action = 'show'] = process.argv.slice(2)
if (!['show', 'apply'].includes(action) || process.argv.length > 3) {
  throw new Error('Usage: npm run password-policy -- show|apply')
}
const {app, auth} = connectFirebase()
try {
  const manager = auth.projectConfigManager()
  const before = (await manager.getProjectConfig()).passwordPolicyConfig
  if (action === 'apply') {
    // Store only the password policy, never credentials or unrelated project settings.
    const directory = new URL('../build/backups/', import.meta.url)
    await mkdir(directory, {recursive: true})
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    await writeFile(new URL(`password-policy-${timestamp}.json`, directory),
      JSON.stringify({projectId: app.options.projectId, passwordPolicyConfig: before ?? null}, null, 2), {flag: 'wx'})
    await manager.updateProjectConfig({passwordPolicyConfig: {
      enforcementState: 'ENFORCE',
      // Apply to new/reset passwords without locking out existing accounts.
      forceUpgradeOnSignin: false,
      constraints: {...before?.constraints, minLength: 8, requireUppercase: true,
        requireLowercase: false, requireNumeric: true, requireNonAlphanumeric: true},
    }})
  }
  const policy = (await manager.getProjectConfig()).passwordPolicyConfig
  console.log(JSON.stringify({projectId: app.options.projectId, passwordPolicyConfig: policy ?? null}, null, 2))
} catch (error) {
  console.error(`Password policy failed (${error.code ?? 'unknown'}): ${error.message}`)
  process.exitCode = 1
} finally {
  await deleteApp(app)
}
