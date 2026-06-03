import { test, expect } from '@playwright/test'
import { fixtures } from './fixtures'

// Services happy-path: главная services-тенанта → service в корзину → /cart →
// "Подобрать время" → /appointments/checkout → дата → слот → контакты → success.
test.use({ baseURL: `http://${fixtures.servicesTenantSlug}.localhost:4711` })

test('appointment flow: service → schedule → contact → success', async ({ page }) => {
  // /menu всегда отдаёт ServicesSection в режиме cards (защищаемся от
  // siteLayout.defaultView='categories' на главной).
  await page.goto('/menu')

  // services-start = branchSelectionMode='per_branch' → BranchPickerModal
  // автооткрывается до выбора филиала. Closable=false, ESC не закрыть —
  // нужно выбрать первый филиал явно. На single-branch тенанте всё равно
  // показывается (модал не auto-pick'ает).
  const branchItem = page.getByTestId('branch-picker-item').first()
  await branchItem.waitFor({ state: 'visible', timeout: 10_000 })
  await branchItem.click()
  // Ждём пока FsDialog финиширует анимацию закрытия и dialog исчезнет из DOM.
  // toBeHidden() корректно работает и для detached (Teleport unmount), и для
  // display:none/visibility:hidden — robustnee чем waitFor({state:'hidden'}).
  await expect(page.getByTestId('branch-picker-list')).toBeHidden({ timeout: 10_000 })

  // SfProductCard рендерит mobile-compact + default обе; CSS прячет одну.
  const addBtn = page.locator('[data-testid="product-card-service"]:visible [data-testid="product-add"]').first()
  await addBtn.waitFor({ state: 'visible', timeout: 15_000 })
  await addBtn.click()

  const cartFab = page.getByTestId('cart-fab')
  await expect(cartFab).toBeVisible()
  await cartFab.click()

  await expect(page).toHaveURL(/\/cart$/)
  await page.getByTestId('cart-services-checkout-btn').click()
  await expect(page).toHaveURL(/\/appointments\/checkout$/)

  // Берём первую дату недели, у которой РЕАЛЬНО есть свободный слот, а не первую
  // кликабельную. «Сегодня» может быть уже закрыто (nightly идёт поздно вечером по
  // TZ тенанта) — date-стрип всё равно показывает сегодня кликабельным, но окон нет.
  const dateButtons = page.getByTestId('appointment-dates').locator('button:not([disabled])')
  await dateButtons.first().waitFor({ state: 'visible', timeout: 15_000 })
  const dateCount = await dateButtons.count()

  let slotPicked = false
  for (let i = 0; i < dateCount; i++) {
    await dateButtons.nth(i).click()
    const slot = page.getByTestId('appointment-slots').locator('button:not([disabled])').first()
    try {
      await slot.waitFor({ state: 'visible', timeout: 4_000 })
      slotPicked = true
      break
    } catch {
      // У этой даты нет свободных окон — пробуем следующую.
    }
  }
  expect(slotPicked, 'ни одна дата недели не имеет свободных слотов — проверь seed расписаний ресурсов (resource_schedules)').toBe(true)

  await page.getByTestId('appointment-slots').locator('button:not([disabled])').first().click()

  await page.getByTestId('appointment-slots-confirm').click()

  await page.getByTestId('appointment-name').fill('E2E Test')
  await page.getByTestId('appointment-phone').fill(fixtures.phoneMarker)
  await page.getByTestId('appointment-submit').click()

  await expect(page.getByTestId('appointment-success')).toBeVisible({ timeout: 15_000 })
})
