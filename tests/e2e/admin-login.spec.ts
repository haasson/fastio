import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Admin login: email/password из seed (пароль пересоздаётся global-setup'ом).
// После успешного логина admin делает window.location.href='/' — поэтому
// проверяем URL на корне.
test.use({ baseURL: 'http://localhost:4710' })

test('admin login → dashboard', async ({ page }) => {
  await page.goto('/login')

  const form = page.getByTestId('admin-login-form')
  await form.waitFor({ state: 'visible', timeout: 15_000 })

  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()

  // После login → hard reload на /. Sidebar должен быть виден.
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
  // Дашборд-ссылка всегда в навигации (it's the home item).
  await expect(page.getByTestId('admin-nav-dashboard')).toBeVisible()
})
