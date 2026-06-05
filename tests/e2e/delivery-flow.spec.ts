import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Retail delivery happy-path: гость добавляет блюдо → корзина → checkout →
// вкладка ДОСТАВКА → вводит адрес (Dadata замокан) → выбирает подсказку →
// координаты попадают в seeded-зону доставки demo → телефон → submit → /order/[id].
//
// Отличие от order-flow (pickup): тут адресный автокомплит зависит от внешнего
// Dadata. Мокаем только /api/dadata/suggest — координаты в подсказке реальные
// (центроид зоны «Гаражи» demo), поэтому /api/check-address НЕ мокаем: серверный
// point-in-polygon по seeded delivery_zones отрабатывает по-настоящему.
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.3' },
})

// Координаты — центроид seeded-зоны «Гаражи» (demo, филиал «Первый», активен,
// не архивирован). Точка попадает в «Гаражи» (fee 99, min_order 300) и
// «Шотландия» (fee 149, min 500); findDeliveryZone выберет дешёвую — «Гаражи».
// Маргарита 590 ≥ 300 → выше min_order, доставка доступна.
const ZONE_LAT = '53.34811099822408'
const ZONE_LON = '83.67025022998699'
const ADDRESS_LABEL = 'Барнаул, ул. Тестовая, д. 1'

test('delivery flow: add dish → delivery checkout → submit → order page', async ({ page }) => {
  // Мок Dadata: один suggestion с координатами внутри зоны доставки. Форма
  // объекта повторяет реальный ответ — фронт читает s.value и s.data.geo_lat/lon.
  await page.route('**/api/dadata/suggest', (route) =>
    route.fulfill({
      json: {
        suggestions: [
          {
            value: ADDRESS_LABEL,
            unrestricted_value: ADDRESS_LABEL,
            data: {
              geo_lat: ZONE_LAT,
              geo_lon: ZONE_LON,
              qc_geo: '0',
              city_with_type: 'г Барнаул',
              street_with_type: 'ул Тестовая',
              house: '1',
              house_type: 'д',
            },
          },
        ],
      },
    }),
  )

  await page.goto('/')

  // Маргарита — не комбо: branchCompat детерминирован, цена 590 (> min_order зоны).
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

  // Переключаемся на доставку — рендерится CheckoutAddressSection → у гостя
  // сразу AddressManualInput с полем адреса.
  await page.getByTestId('checkout-tab-delivery').click()

  const addressInput = page.getByTestId('checkout-address-input')
  await addressInput.waitFor({ state: 'visible', timeout: 15_000 })
  // ≥3 символов — иначе useDadataSuggestions не дёргает proxy. Debounce 500мс.
  await addressInput.fill('Барнаул, ул. Тестовая')

  // Подсказка из мока — кликаем по тексту value. FsDropdownList рендерит
  // <button> с текстом suggestion.value; нет своего testid, селектим по тексту.
  const suggestion = page.locator('.dropdown-item', { hasText: ADDRESS_LABEL }).first()
  await suggestion.waitFor({ state: 'visible', timeout: 15_000 })
  await suggestion.click()

  // Выбор адреса дёргает реальный /api/check-address → ждём плашку «Доставка»
  // (успешное попадание в зону), а не магический таймаут.
  await expect(page.getByText(/Доставка:/).first()).toBeVisible({ timeout: 15_000 })

  // Гостевая форма: телефон обязателен.
  await page.getByTestId('checkout-phone').fill(fixtures.phoneMarker)

  await page.getByTestId('checkout-submit').click()

  await page.waitForURL(/\/order\//, { timeout: 15_000 })
  await expect(page.getByTestId('order-page')).toBeVisible()
  await expect(page.getByTestId('order-number')).toContainText(/Заказ #/)
})
