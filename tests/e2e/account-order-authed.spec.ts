import { test, expect } from '@playwright/test'
import { fixtures, tgSessionCookie } from './fixtures'
import { submitPickupOrder } from './helpers'

// Авторизованный (tg_session) клиент оформляет заказ — заказ должен привязаться
// к его customer_id и появиться в истории /account/orders. Гостевой бы не попал,
// поэтому тест реально проверяет auth-привязку заказа, а не сам submit.
//
// Регрессия PREPROD-099: tg-клиент не имеет supabase-сессии, и (1) orders.post.ts
// привязывал customer только по Bearer, (2) orders.vue бейлился без supabase-сессии.
// Свой x-real-ip → отдельный rate-limit-бакет (orders:tenant-ip 5/60s в orders.post).
// Без этого 1-worker + один socket-IP копит заказы в demo и 6-й сабмит ловит 429.
// В CI заголовок читается (TRUST_PROXY в playwright.config), локально игнорируется.
test.use({
  baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711`,
  extraHTTPHeaders: { 'x-real-ip': '203.0.113.1' },
})

test('авторизованный клиент: заказ привязывается и виден в истории кабинета', async ({ page, context }) => {
  await context.addCookies([tgSessionCookie('retail')])

  const orderCode = await submitPickupOrder(page)

  await page.goto('/account/orders')
  const item = page.getByTestId('account-order-item').filter({ hasText: orderCode })
  await expect(item).toBeVisible({ timeout: 15_000 })
})
