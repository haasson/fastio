import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Промокод в чекауте (retail demo): dish → cart → pickup checkout → ввод промокода
// E2E10 (10%) → применить → проверяем что скидка применилась (статус + размер).
// Затем submit и проверка перехода на /order/[id].
//
// Промокод E2E10 сидится в scripts/e2e/setup.mjs (globalSetup): percent=10, без
// min_order и без дат → валиден для любой непустой корзины. Маргарита = 590,
// скидка = 59.
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.6' },
})

test('promo flow: apply promo code in checkout → discount applied', async ({ page }) => {
  await page.goto('/')

  // Берём Маргариту (не первую карточку — там combo с 'red' pickup branchCompat).
  // :visible — SfProductCard рендерит mobile + default DOM, CSS прячет одну.
  const pizzaCard = page.locator('[data-testid="product-card-dish"]:visible', { hasText: 'Маргарита' }).first()
  await pizzaCard.waitFor({ state: 'visible', timeout: 15_000 })
  await pizzaCard.locator('[data-testid="product-add"]:visible').first().click()

  const cartFab = page.getByTestId('cart-fab')
  await expect(cartFab).toBeVisible()
  await cartFab.click()

  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByTestId('cart-line-item')).toHaveCount(1)

  await page.getByTestId('cart-checkout-btn').click()
  await expect(page).toHaveURL(/\/checkout$/)

  // Pickup-ветка детерминирована (delivery требует Dadata, который не мокаем).
  await page.getByTestId('checkout-tab-pickup').click()
  const enabledBranch = page.locator('[data-testid="pickup-branch-card"]:not([disabled])').first()
  await enabledBranch.waitFor({ state: 'visible', timeout: 15_000 })
  await enabledBranch.click()

  // Секция промокода рендерится только при modules.promotions (у demo — true).
  const promoInput = page.getByTestId('checkout-promo-input')
  await expect(promoInput).toBeVisible()
  await promoInput.fill('E2E10')
  await page.getByTestId('checkout-promo-apply').click()

  // Промокод принят + показан размер скидки (10% от 590 = 59).
  const promoResult = page.getByTestId('checkout-promo-result')
  await expect(promoResult).toContainText('Промокод принят')
  await expect(page.getByTestId('checkout-promo-discount')).toContainText('59')

  // Submit и переход на страницу заказа.
  await page.getByTestId('checkout-phone').fill(fixtures.phoneMarker)
  await page.getByTestId('checkout-submit').click()

  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  await expect(page.getByTestId('order-page')).toBeVisible()
  await expect(page.getByTestId('order-number')).toContainText(/Заказ #/)
})
