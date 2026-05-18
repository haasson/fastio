import { test, expect } from '@playwright/test'

// Smoke: главная demo-тенанта загружается без 404/500 + без JS-исключений в
// рантайме. Last-mile проверки (что заказ оформляется) — в order-flow.spec.ts.
test.use({ baseURL: 'http://demo.localhost:4711' })

test('storefront home loads without errors', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (err) => pageErrors.push(err))

  const response = await page.goto('/')

  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
  // SSR может вернуть 200 даже если скрипт упал — ловим runtime exceptions.
  expect(pageErrors, `unexpected pageerror: ${pageErrors.map((e) => e.message).join('\n')}`).toEqual([])
})
