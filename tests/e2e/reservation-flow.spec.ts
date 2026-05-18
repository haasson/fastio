import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Reservation happy-path: /booking → дата → гости → имя+телефон → submit → success.
// На demo-тенанте reservations включены, 3 филиала (но booking может работать
// и без явного выбора — единый branch_id выставляется автоматически на витрине,
// см. tenant.branchSelectionMode).
test.use({ baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711` })

test('reservation flow: pick date+time → contact → submit → success', async ({ page }) => {
  await page.goto('/booking')

  // demo имеет >1 филиала → BookingStepParams требует выбрать филиал перед
  // переходом на step 2. На single-branch тенанте этот блок скрыт.
  const branchPicker = page.getByTestId('booking-branches')
  if (await branchPicker.isVisible().catch(() => false)) {
    await page.getByTestId('booking-branch').first().click()
  }

  // Step 1: дата. Берём ВТОРУЮ доступную — сегодня к концу дня свободных слотов
  // может не быть (тест flaky если гонять под вечер). Завтра гарантированно
  // есть полная сетка.
  const dates = page.getByTestId('booking-dates').locator('button:not([disabled])')
  await dates.first().waitFor({ state: 'visible', timeout: 15_000 })
  const dateCount = await dates.count()
  await dates.nth(dateCount > 1 ? 1 : 0).click()

  await page.getByTestId('booking-step1-next').click()

  // Step 2: первый доступный слот.
  const firstSlot = page.getByTestId('booking-slots').locator('button:not([disabled])').first()
  await firstSlot.waitFor({ state: 'visible', timeout: 15_000 })
  await firstSlot.click()

  await page.getByTestId('booking-step2-next').click()

  // Step 3: контакты + submit.
  await page.getByTestId('booking-name').fill('E2E Test')
  await page.getByTestId('booking-phone').fill(fixtures.phoneMarker)
  await page.getByTestId('booking-submit').click()

  await expect(page.getByTestId('booking-success')).toBeVisible({ timeout: 15_000 })
})
