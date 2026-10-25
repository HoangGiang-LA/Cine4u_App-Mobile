import { expect, test } from '@playwright/test'

// These requests are fulfilled locally; no test account, token or request reaches Firebase.
test('Firebase SDK sends sign-in and displays provider setup errors', async ({ page }) => {
  let requestEmail = ''
  await page.route('https://**/*', (route) => route.abort())
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/accounts:signInWithPassword')) {
      requestEmail = route.request().postDataJSON().email
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 400, message: 'OPERATION_NOT_ALLOWED' } }),
      })
    } else await route.abort()
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill('sdk-test@example.test')
  await page.getByLabel('Password').fill('not-a-real-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Enable it in Firebase Authentication')
  expect(requestEmail).toBe('sdk-test@example.test')
  await expect(page.getByLabel('Password')).toHaveValue('')
  await expect(page.getByRole('navigation')).not.toBeVisible()
})

test('Firebase SDK restores a session, keeps non-admin access blocked and signs out before demo', async ({
  page,
}) => {
  const projectId = 'englishbattleapp-8d764',
    uid = 'local-auth-test',
    email = 'sdk-test@example.test',
    now = Math.floor(Date.now() / 1000)
  const encode = (s: unknown) => Buffer.from(JSON.stringify(s)).toString('base64url')
  const token = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: uid, user_id: uid, email, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'password', identities: { email: [email] } } })}.local-test-signature`
  await page.route('https://**/*', (route) => route.abort())
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/accounts:signInWithPassword')) {
      await route.fulfill({
        json: {
          localId: uid,
          email,
          idToken: token,
          refreshToken: 'local-test-refresh',
          expiresIn: '3600',
          registered: true,
        },
      })
    } else if (path.endsWith('/accounts:lookup')) {
      await route.fulfill({
        json: {
          users: [
            {
              localId: uid,
              email,
              displayName: 'SDK Test User',
              emailVerified: false,
              providerUserInfo: [{ providerId: 'password', email, rawId: email }],
            },
          ],
        },
      })
    } else await route.abort()
  })
  await page.goto('/')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill('not-a-real-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Firebase account connected' })).toBeVisible()
  await expect(page.getByText('Not assigned', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation')).not.toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Firebase account connected' })).toBeVisible()
  await page.getByRole('button', { name: 'Open demo workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'English Battle', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})
