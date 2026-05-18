import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Admin создаёт dish в demo-тенанте. Тест включает inline login — отдельной
// фабрики storage-state пока не делаем (логин дёшев, ~2 сек).
test.use({ baseURL: 'http://localhost:4710' })

test('admin can create a dish', async ({ page }) => {
  // Login.
  await page.goto('/login')
  await page.getByTestId('admin-login-email').locator('input').fill(fixtures.adminEmail)
  await page.getByTestId('admin-login-password').locator('input').fill(fixtures.adminPassword)
  await page.getByTestId('admin-login-submit').click()
  // После login admin делает window.location.href='/' — полный reload. Ждём
  // не только появление nav, но и полную гидрацию: networkidle гарантирует
  // что Pinia stores + auth context дозагружены и NuxtLink реально кликабельны.
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')

  // NuxtLink рендерится в `<a>`, data-testid пробрасывается на него через
  // fallthrough → click работает напрямую без .locator('a'). /menu редиректит
  // в /menu/dishes (см. nuxt.config routeRules).
  await page.getByTestId('admin-nav-menu').click()
  await page.waitForURL(/\/menu(\/.*)?$/, { timeout: 10_000 })

  // По умолчанию открывается категория "Комбо" → рендерится MenuComboList,
  // в нём нет dish-add-btn. Переключаемся на любую обычную regular-категорию.
  await page.getByText('Пицца').first().click()

  const addBtn = page.getByTestId('dish-add-btn')
  await addBtn.waitFor({ state: 'visible', timeout: 20_000 })
  await addBtn.click()

  // Drawer открыт — name + price.
  const dishName = `E2E Test Dish ${Date.now()}`
  await page.getByTestId('catalog-item-name').locator('input').fill(dishName)
  await page.getByTestId('catalog-item-price').locator('input').fill('199')

  await page.getByTestId('dish-form-save').click()

  // Drawer закрывается, dish появляется в списке.
  await expect(page.getByText(dishName)).toBeVisible({ timeout: 15_000 })
})
