import { type Page, expect } from '@playwright/test'
import { fixtures } from './fixtures'

export const ADMIN_URL = 'http://localhost:4710'

// Гостевой pickup happy-path на storefront demo-тенанта: блюдо → корзина →
// checkout pickup → submit. Возвращает номер заказа (ОПП-…) с /order/[id].
// Берём Маргариту (не комбо — у комбо branchCompat 'red', тест встал бы на филиале).
export async function submitPickupOrder(page: Page, dishName = 'Маргарита'): Promise<string> {
  await page.goto('/')

  const card = page.locator('[data-testid="product-card-dish"]:visible', { hasText: dishName }).first()
  await card.waitFor({ state: 'visible', timeout: 15_000 })
  await card.locator('[data-testid="product-add"]:visible').first().click()

  await page.getByTestId('cart-fab').click()
  await expect(page).toHaveURL(/\/cart$/)
  await page.getByTestId('cart-checkout-btn').click()
  await expect(page).toHaveURL(/\/checkout$/)

  await page.getByTestId('checkout-tab-pickup').click()
  const enabledBranch = page.locator('[data-testid="pickup-branch-card"]:not([disabled])').first()
  await enabledBranch.waitFor({ state: 'visible', timeout: 15_000 })
  await enabledBranch.click()

  // Гость заполняет телефон вручную; у авторизованного (tg_session) телефон уже
  // на файле — поля нет (checkout.vue: v-if="authStore.isAuthenticated").
  const phoneField = page.getByTestId('checkout-phone')
  if (await phoneField.count() > 0) {
    await phoneField.fill(fixtures.phoneMarker)
  }
  await page.getByTestId('checkout-submit').click()

  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  const orderNumberText = await page.getByTestId('order-number').textContent()
  const orderCode = orderNumberText?.match(/#\s*(\S+)/)?.[1]
  expect(orderCode, 'не удалось вытащить номер заказа из /order/[id]').toBeTruthy()

  return orderCode!
}

// Логин в админку demo-тенанта (owner demo@fastio.app, пароль зафиксирован setup.mjs).
export async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${ADMIN_URL}/login`)
  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
}
