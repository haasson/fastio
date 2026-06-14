import { test, expect, type Page } from '@playwright/test'
import { fixtures } from './fixtures'
import { adminLogin, ADMIN_URL } from './helpers'

// Срез 3: правка состава ПРИНЯТОГО заказа. Оператор удаляет позицию из заказа,
// уже переведённого в группу in_progress — путь идёт через RPC remove_order_item
// (не in-memory), с гардом «нельзя удалить последнюю позицию».
//
// Kitchen-lock (нельзя трогать готовящуюся позицию), пересчёт сумм с
// модификаторами/добавками и блокировка по cancelled-тикетам покрыты на уровне
// SQL-smoke + юнит (для них нужно состояние kitchen_queue, недостижимое из
// happy-path витрины). Здесь — UI-граница: контролы появляются только на принятом
// заказе и удаление реально применяется.
//
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.7' },
})

// Гостевой pickup с ДВУМЯ разными позициями (нужно ≥2 для проверки last-item-гарда).
async function submitTwoItemPickupOrder(page: Page): Promise<string> {
  await page.goto('/')

  for (const dish of ['Маргарита', 'Пепперони']) {
    const card = page.locator('[data-testid="product-card-dish"]:visible', { hasText: dish }).first()
    await card.waitFor({ state: 'visible', timeout: 15_000 })
    await card.locator('[data-testid="product-add"]:visible').first().click()
  }

  await page.getByTestId('cart-fab').click()
  await expect(page).toHaveURL(/\/cart$/)
  await page.getByTestId('cart-checkout-btn').click()
  await expect(page).toHaveURL(/\/checkout$/)

  await page.getByTestId('checkout-tab-pickup').click()
  const enabledBranch = page.locator('[data-testid="pickup-branch-card"]:not([disabled])').first()
  await enabledBranch.waitFor({ state: 'visible', timeout: 15_000 })
  await enabledBranch.click()

  const phoneField = page.getByTestId('checkout-phone')
  if (await phoneField.count() > 0) {
    await phoneField.fill(fixtures.phoneMarker)
  }
  await page.getByTestId('checkout-submit').click()

  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  const orderNumberText = await page.getByTestId('order-number').textContent()
  const orderCode = orderNumberText?.match(/#\s*(\S+)/)?.[1]
  expect(orderCode, 'не удалось вытащить номер заказа').toBeTruthy()

  return orderCode!
}

test('оператор удаляет позицию из принятого заказа, последнюю удалить нельзя', async ({ page }) => {
  const orderCode = await submitTwoItemPickupOrder(page)

  await adminLogin(page)
  await page.goto(`${ADMIN_URL}/orders`)

  // Принимаем заказ (group=new → in_progress) — только на принятом доступна
  // точечная правка состава (perms.editAcceptedItems).
  const newCard = page.getByTestId('admin-order-card').filter({ hasText: orderCode })
  await expect(newCard).toBeVisible({ timeout: 20_000 })
  await newCard
    .locator('[data-testid="admin-order-quick-action"][data-status-name="Принят"]')
    .click()

  await page.locator('[data-testid="admin-order-status-tab"][data-status-name="Принят"]').click()
  const acceptedCard = page.getByTestId('admin-order-card').filter({ hasText: orderCode })
  await expect(acceptedCard).toBeVisible({ timeout: 20_000 })

  // Открываем дровер заказа.
  await acceptedCard.click()
  const items = page.getByTestId('order-item-row')
  await expect(items).toHaveCount(2, { timeout: 20_000 })

  // Удаляем первую позицию: кнопка-«корзина» (title «Удалить») → подтверждение.
  // Подтверждение скоупим в .modal-actions — иначе name «Удалить» словил бы и
  // саму иконку-корзину (её accessible-name = title «Удалить»).
  await items.first().getByTitle('Удалить', { exact: true }).click()
  await page.locator('.modal-actions').getByRole('button', { name: 'Удалить' }).click()

  // Осталась одна позиция (RPC применился, дровер перезагрузил заказ).
  await expect(items).toHaveCount(1, { timeout: 20_000 })

  // Last-item guard: удаление последней позиции заблокировано (кнопка disabled,
  // title объясняет причину).
  await expect(items.first().getByTitle('Нельзя удалить последнюю позицию')).toBeDisabled()
})
