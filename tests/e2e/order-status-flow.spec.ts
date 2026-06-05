import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'
import { submitPickupOrder, adminLogin, ADMIN_URL } from './helpers'

// Status-машина заказа: оператор двигает заказ по вкладкам статусов.
// Гость оформляет pickup-заказ на витрине (статус group=new «Новый»), затем в
// админке оператор жмёт quick-action «Принят» на карточке. Проверяем, что заказ
// действительно переехал в группу in_progress: карточка с тем же номером видна
// во вкладке «Принят» и её тег статуса обновился на «Принят».
//
// Почему так устойчиво: OrderList фильтрует заказы по выбранной вкладке статуса,
// поэтому позитивная проверка «заказ появился во вкладке-цели» не зависит от
// тайминга оптимистичного удаления карточки из исходной вкладки.
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.5' },
})

test('заказ переводится из «Новый» в «Принят» через quick-action', async ({ page }) => {
  const orderCode = await submitPickupOrder(page)

  await adminLogin(page)
  await page.goto(`${ADMIN_URL}/orders`)

  // Дефолтная вкладка — «Новый» (позиция 0, group=new). Находим карточку заказа.
  const newCard = page.getByTestId('admin-order-card').filter({ hasText: orderCode })
  await expect(newCard).toBeVisible({ timeout: 20_000 })
  await expect(newCard.getByTestId('admin-order-status')).toHaveText('Новый')

  // Quick-action «Принят» (group=new разрешает переход в in_progress).
  await newCard
    .locator('[data-testid="admin-order-quick-action"][data-status-name="Принят"]')
    .click()

  // Переключаемся на вкладку «Принят» и убеждаемся, что заказ туда переехал.
  await page.locator('[data-testid="admin-order-status-tab"][data-status-name="Принят"]').click()

  const acceptedCard = page.getByTestId('admin-order-card').filter({ hasText: orderCode })
  await expect(acceptedCard).toBeVisible({ timeout: 20_000 })
  await expect(acceptedCard.getByTestId('admin-order-status')).toHaveText('Принят')
})
