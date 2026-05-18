import { test, expect } from '@playwright/test'

// Smoke: admin loads, login страница видна (после ssr:true + routeRules /**:
// ssr:false фикса в nuxt.config.ts — vite-node socket теперь поднимается).
test.use({ baseURL: 'http://localhost:4710' })

test('admin login page loads', async ({ page }) => {
  const response = await page.goto('/login')

  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
})
