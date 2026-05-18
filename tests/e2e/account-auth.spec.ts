import { test, expect } from '@playwright/test'
import { fixtures, tgSessionCookie } from './fixtures'

// Customer account: пользователь приходит с уже выпущенной tg_session (создана
// в global setup). Проверяем что /account отдаёт хаб карточек и навигация в
// /account/profile работает (нет редиректа на главную).
test.use({ baseURL: `http://${fixtures.retailTenantSlug}.localhost:4711` })

test('account hub renders for logged-in customer (tg_session)', async ({ page, context }) => {
  await context.addCookies([tgSessionCookie('retail')])

  await page.goto('/account')

  await expect(page.getByTestId('account-hub')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('account-card-profile')).toBeVisible()
  await expect(page.getByTestId('account-card-orders')).toBeVisible()
  // reservations модуль включён на demo-тенанте.
  await expect(page.getByTestId('account-card-reservations')).toBeVisible()

  await page.getByTestId('account-card-profile').click()
  await expect(page).toHaveURL(/\/account\/profile$/)
})
