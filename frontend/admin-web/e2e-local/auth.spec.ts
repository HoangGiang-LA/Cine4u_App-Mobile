import {expect, test} from '@playwright/test'

test.beforeEach(async ({page}) => {
  // Prevent accidental external requests; allow the real loopback services through.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
})

test('real demo admin signs in through Auth, BE1 Callable and HTTP then opens Dashboard', async ({page}) => {
  const calls: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() === 'POST') calls.push(request.url()) })
  await page.goto('/')
  await page.getByLabel('Email address').fill('admin@example.test')
  await page.getByLabel('Password').fill('LocalDemo123!')
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect(page.getByText('Total Users', {exact: true})).toBeVisible()
  const provision = calls.findIndex(url => url.includes('/demo-englishbattle/asia-southeast1/ensureUserProfile'))
  const authorize = calls.findIndex(url => url.includes(':8080/api/getAdminSession'))
  expect(calls.some(url => url.includes(':9099/') && url.includes('accounts:signInWithPassword'))).toBe(true)
  expect(provision).toBeGreaterThanOrEqual(0)
  expect(authorize).toBeGreaterThan(provision)
  expect(errors).toEqual([])
  await page.screenshot({path: 'test-results/local-admin-dashboard.png', fullPage: true})
})

test('real ordinary demo user remains outside the Admin workspace', async ({page}) => {
  await page.goto('/')
  await page.getByLabel('Email address').fill('learner@example.test')
  await page.getByLabel('Password').fill('LocalDemo123!')
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.getByRole('heading', {name: 'Administrator access required'})).toBeVisible()
  await expect(page.getByRole('navigation')).not.toBeVisible()
})
