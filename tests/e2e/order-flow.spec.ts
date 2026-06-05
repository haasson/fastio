import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Retail order happy-path: dish → cart → pickup checkout → submit → /order/[id].
// Гостевой submit (без auth) — guard-валидация формы строже, лучше отлавливает регрессии.
// Pickup, а не delivery: address validation требует Dadata fetch который мы не
// мокаем; pickup-ветка детерминирована и не зависит от внешних API.
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.4' },
})

test('order flow: add dish → checkout → submit → order page', async ({ page }) => {
  // Главная demo-тенанта — там MenuSection с активными dishes.
  await page.goto('/')

  // Берём конкретное блюдо (Маргарита) а не первую карточку: первая в demo —
  // комбо, у которого pickup branchCompat считается 'red' (combo не привязан
  // к branchIds), и тест встаёт на этапе выбора филиала самовывоза.
  //
  // :visible важен: SfProductCard рендерит mobile-compact + default DOM (CSS
  // прячет одну через breakpoint). На holder-card в SfProductCard.vue:5,54 две
  // одноимённые карточки — без :visible тест может зацепить hidden и упасть
  // по actionTimeout (см. appointment-flow.spec.ts для того же паттерна).
  const pizzaCard = page.locator('[data-testid="product-card-dish"]:visible', { hasText: 'Маргарита' }).first()
  await pizzaCard.waitFor({ state: 'visible', timeout: 15_000 })
  await pizzaCard.locator('[data-testid="product-add"]:visible').first().click()

  // FAB корзины появляется как только в корзине что-то есть.
  const cartFab = page.getByTestId('cart-fab')
  await expect(cartFab).toBeVisible()
  await cartFab.click()

  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByTestId('cart-line-item')).toHaveCount(1)

  await page.getByTestId('cart-checkout-btn').click()
  await expect(page).toHaveURL(/\/checkout$/)

  // Переключаемся на pickup и выбираем первый совместимый филиал. branchCompat
  // считается из menuStore.allDishes — реактивно, как только store наполнится.
  // Ждём сразу появления enabled-карточки (а не magic-таймаута).
  await page.getByTestId('checkout-tab-pickup').click()
  const enabledBranch = page.locator('[data-testid="pickup-branch-card"]:not([disabled])').first()
  await enabledBranch.waitFor({ state: 'visible', timeout: 15_000 })
  await enabledBranch.click()

  // Гостевая форма: только phone обязателен. FsInput пробрасывает data-testid
  // прямо на `<input>` через v-bind="$attrs", `locator('input')` не нужен.
  await page.getByTestId('checkout-phone').fill(fixtures.phoneMarker)

  await page.getByTestId('checkout-submit').click()

  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  await expect(page.getByTestId('order-page')).toBeVisible()
  await expect(page.getByTestId('order-number')).toContainText(/Заказ #/)
})
