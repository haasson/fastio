import { test, expect } from '@playwright/test'

// Smoke: открываем главную demo-тенанта, убеждаемся что страница загружается
// без 404/500 и в DOM есть базовая структура. Использует существующий локальный
// `demo` тенант (см. tenants table), потом перейдём на чистый e2e-тенант после
// seed-script'а в следующем коммите.
test.use({ baseURL: 'http://demo.localhost:4711' })

test('storefront home loads without errors', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.status()).toBeLessThan(400)

  // Любой контент тенанта (имя из tenant.name) или базовая структура страницы.
  await expect(page.locator('body')).toBeVisible()
})
