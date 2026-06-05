import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'
import { submitPickupOrder, adminLogin, ADMIN_URL } from './helpers'

// Core value: «заказ клиента должен поступить в заведение без потерь». order-flow
// доводит до клиентской /order/[id], но НЕ проверяет, что заказ долетел до админки.
// Этот тест закрывает границу storefront → БД → admin: гость оформляет заказ на
// витрине, затем в админке этот же заказ виден в списке (вкладка «Новый»).
// Свой x-real-ip → отдельный rate-limit-бакет заказов (см. account-order-authed).
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.2' },
})

test('заказ с витрины появляется в админском списке', async ({ page }) => {
  const orderCode = await submitPickupOrder(page)

  await adminLogin(page)
  await page.goto(`${ADMIN_URL}/orders`)

  // Заказ с витрины получает статус group=new («Новый») — это дефолтная вкладка.
  const orderCard = page.getByTestId('admin-order-card').filter({ hasText: orderCode })
  await expect(orderCard).toBeVisible({ timeout: 20_000 })
  await expect(orderCard).toContainText('Маргарита')
})
