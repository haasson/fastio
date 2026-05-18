import { test, expect } from '@playwright/test'

// Smoke: admin login страница загружается без 404/500 + без runtime JS-исключений
// (после ssr:true + routeRules /**: ssr:false фикса в nuxt.config.ts).
test.use({ baseURL: 'http://localhost:4710' })

test('admin login page loads', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (err) => pageErrors.push(err))

  const response = await page.goto('/login')

  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
  expect(pageErrors, `unexpected pageerror: ${pageErrors.map((e) => e.message).join('\n')}`).toEqual([])
})
