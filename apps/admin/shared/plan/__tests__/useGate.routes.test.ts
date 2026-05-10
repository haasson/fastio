import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveRouteGate, isUngatedRoute, REDIRECT_FALLBACKS } from '../useGate.routes'

const PAGES = resolve(__dirname, '../../../pages')

describe('isUngatedRoute', () => {
  it.each([
    '/login',
    '/invite',
    '/set-password',
    '/no-access',
    '/suspended',
    '/legal/privacy',
    '/legal/oferta',
    '/account',
    '/account/profile',
    '/account/billing',
    '/help',
    '/help/tours',
    '/help/support',
  ])('считает %s ungated', (path) => {
    expect(isUngatedRoute(path)).toBe(true)
  })

  it.each([
    '/',
    '/tables',
    '/orders/123',
    '/menu/dishes',
    '/legalnotreally', // не должен матчить /legal* без слэша
    '/accountant', // не должен матчить /account*
    '/helpful',
  ])('считает %s gated', (path) => {
    expect(isUngatedRoute(path)).toBe(false)
  })
})

describe('resolveRouteGate', () => {
  describe('корень и ungated', () => {
    it('/ → dashboard', () => {
      expect(resolveRouteGate('/')).toBe('dashboard')
    })

    it('ungated роуты возвращают null', () => {
      expect(resolveRouteGate('/login')).toBeNull()
      expect(resolveRouteGate('/account/profile')).toBeNull()
      expect(resolveRouteGate('/help')).toBeNull()
      expect(resolveRouteGate('/legal/privacy')).toBeNull()
    })

    it('неизвестный роут — null (404 рендерится как есть)', () => {
      expect(resolveRouteGate('/some-unknown-page')).toBeNull()
    })
  })

  describe('корни секций (соответствуют AppNav)', () => {
    it.each([
      ['/menu', 'viewMenu'],
      ['/services', 'viewServiceMenu'],
      ['/orders', 'viewOrders'],
      ['/kitchen', 'viewKitchen'],
      ['/tables', 'viewTables'],
      ['/reservations', 'viewReservations'],
      ['/appointments', 'viewAppointments'],
      ['/promotions', 'managePromotions'],
      ['/team', 'manageTeam'],
      ['/branches', 'viewBranches'],
      ['/content', 'viewContent'],
      ['/appearance', 'viewContent'],
      ['/settings', 'viewSettings'],
      ['/audit-log', 'viewAuditLog'],
    ])('%s → %s', (path, expected) => {
      expect(resolveRouteGate(path)).toBe(expected)
    })
  })

  describe('суб-роуты наследуют гейт секции', () => {
    it('/tables/list → viewTables', () => {
      expect(resolveRouteGate('/tables/list')).toBe('viewTables')
    })

    it('/tables/layout → viewTables', () => {
      expect(resolveRouteGate('/tables/layout')).toBe('viewTables')
    })

    it('/tables/calls → viewTables', () => {
      expect(resolveRouteGate('/tables/calls')).toBe('viewTables')
    })

    it('/orders/abc-123 (детали заказа) → viewOrders', () => {
      expect(resolveRouteGate('/orders/abc-123')).toBe('viewOrders')
    })

    it('/menu/dishes → viewMenu (унаследовано от /menu)', () => {
      expect(resolveRouteGate('/menu/dishes')).toBe('viewMenu')
    })

    it('/settings/contacts → viewSettings', () => {
      expect(resolveRouteGate('/settings/contacts')).toBe('viewSettings')
    })

    it('/content/banners → viewContent', () => {
      expect(resolveRouteGate('/content/banners')).toBe('viewContent')
    })

    it('/appearance/theme → viewContent', () => {
      expect(resolveRouteGate('/appearance/theme')).toBe('viewContent')
    })

    it('/team/members → manageTeam', () => {
      expect(resolveRouteGate('/team/members')).toBe('manageTeam')
    })
  })

  describe('суб-роуты со своими (более строгими) гейтами', () => {
    it('/orders/settings → editSettings (а не viewOrders)', () => {
      expect(resolveRouteGate('/orders/settings')).toBe('editSettings')
    })

    it('/orders/statuses → editSettings', () => {
      expect(resolveRouteGate('/orders/statuses')).toBe('editSettings')
    })

    it('/orders/order-number → editSettings', () => {
      expect(resolveRouteGate('/orders/order-number')).toBe('editSettings')
    })

    it('/orders/delivery → delivery', () => {
      expect(resolveRouteGate('/orders/delivery')).toBe('delivery')
    })

    it('/kitchen/queue → viewKitchenQueue', () => {
      expect(resolveRouteGate('/kitchen/queue')).toBe('viewKitchenQueue')
    })

    it('/kitchen/assembly → viewKitchenQueue', () => {
      expect(resolveRouteGate('/kitchen/assembly')).toBe('viewKitchenQueue')
    })

    it('/kitchen/overview → viewKitchenOverview', () => {
      expect(resolveRouteGate('/kitchen/overview')).toBe('viewKitchenOverview')
    })

    it('/kitchen/settings → editSettings', () => {
      expect(resolveRouteGate('/kitchen/settings')).toBe('editSettings')
    })

    it('/menu/categories → manageMenu', () => {
      expect(resolveRouteGate('/menu/categories')).toBe('manageMenu')
    })

    it('/menu/modifiers → modifiers', () => {
      expect(resolveRouteGate('/menu/modifiers')).toBe('modifiers')
    })

    it('/menu/addons → addons', () => {
      expect(resolveRouteGate('/menu/addons')).toBe('addons')
    })

    it('/menu/tags → manageMenu', () => {
      expect(resolveRouteGate('/menu/tags')).toBe('manageMenu')
    })

    it('/services/items → viewServiceMenu', () => {
      expect(resolveRouteGate('/services/items')).toBe('viewServiceMenu')
    })

    it('/services/categories → manageServiceMenu', () => {
      expect(resolveRouteGate('/services/categories')).toBe('manageServiceMenu')
    })

    it('/services/tags → manageServiceMenu', () => {
      expect(resolveRouteGate('/services/tags')).toBe('manageServiceMenu')
    })

    it('/team/roles → manageRoles', () => {
      expect(resolveRouteGate('/team/roles')).toBe('manageRoles')
    })

    it('/reservations/settings → editSettings', () => {
      expect(resolveRouteGate('/reservations/settings')).toBe('editSettings')
    })

    it('/reservations/list → viewReservations', () => {
      expect(resolveRouteGate('/reservations/list')).toBe('viewReservations')
    })
  })

  describe('порядок: специфичные суб-роуты бьют корни секций', () => {
    // Если бы порядок был неправильный, /orders/settings вернул бы viewOrders.
    it('/orders/settings → editSettings (не viewOrders)', () => {
      expect(resolveRouteGate('/orders/settings')).toBe('editSettings')
    })

    it('/menu/modifiers → modifiers (не manageMenu)', () => {
      expect(resolveRouteGate('/menu/modifiers')).toBe('modifiers')
    })

    it('/team/roles → manageRoles (не manageTeam)', () => {
      expect(resolveRouteGate('/team/roles')).toBe('manageRoles')
    })
  })
})

describe('appointments routes (1.7 покрытие)', () => {
  it.each([
    ['/appointments', 'viewAppointments'],
    ['/appointments/staff', 'manageAppointments'],
    ['/appointments/objects', 'manageAppointments'],
    ['/appointments/templates', 'manageAppointments'],
    ['/appointments/settings', 'editSettings'],
  ])('%s → %s', (path, expected) => {
    expect(resolveRouteGate(path)).toBe(expected)
  })

  it('/appointments/list (страница архива) → viewAllAppointments (мастер с view_own не пускается)', () => {
    expect(resolveRouteGate('/appointments/list')).toBe('viewAllAppointments')
  })

  it('/appointments/timeline (главная страница записей) → viewAppointments', () => {
    expect(resolveRouteGate('/appointments/timeline')).toBe('viewAppointments')
  })

  it('/appointments/visits/<uuid> (карточка визита) → viewAllAppointments', () => {
    expect(resolveRouteGate('/appointments/visits/abc-123')).toBe('viewAllAppointments')
  })

  it('/appointments/history наследует от корня → viewAppointments (даже если страницы пока нет)', () => {
    expect(resolveRouteGate('/appointments/history')).toBe('viewAppointments')
  })

  // S7 регрессия: после ребрендинга «ресурсы» → «исполнители/объекты» страницы
  // /appointments/resources быть не должно. Если кто-то её случайно вернёт —
  // тест упадёт и заставит подумать дважды (а заодно onboarding не словит 404).
  it('S7 регрессия: pages/appointments/resources.vue не существует', () => {
    expect(existsSync(resolve(PAGES, 'appointments/resources.vue'))).toBe(false)
  })

  it('S7 регрессия: /appointments/resources не имеет специфичного гейта (только наследование от корня)', () => {
    // Если бы кто-то добавил в ROUTE_GATES `/appointments/resources` со своим
    // гейтом, тест поймал бы это. Сейчас он наследует от `/appointments`.
    expect(resolveRouteGate('/appointments/resources')).toBe('viewAppointments')
  })

  // Sanity: страницы из pages/appointments действительно существуют — иначе тесты
  // выше тестируют гейты для несуществующих файлов.
  it.each([
    'list.vue',
    'objects.vue',
    'settings.vue',
    'staff.vue',
    'templates.vue',
    'timeline.vue',
  ])('pages/appointments/%s существует', (file) => {
    expect(existsSync(resolve(PAGES, 'appointments', file))).toBe(true)
  })
})

describe('services routes (1.7 покрытие)', () => {
  it.each([
    ['/services', 'viewServiceMenu'],
    ['/services/items', 'viewServiceMenu'],
    ['/services/categories', 'manageServiceMenu'],
    ['/services/tags', 'manageServiceMenu'],
  ])('%s → %s', (path, expected) => {
    expect(resolveRouteGate(path)).toBe(expected)
  })

  it('/services/settings наследует от корня → viewServiceMenu', () => {
    // Сейчас в ROUTE_GATES нет специфичного для /services/settings;
    // тест сторожит, что если кто-то захочет ужесточить (например до editSettings) —
    // не забыл сначала актуализировать тест и обсудить.
    expect(resolveRouteGate('/services/settings')).toBe('viewServiceMenu')
  })

  it.each([
    'categories.vue',
    'items.vue',
    'settings.vue',
    'tags.vue',
  ])('pages/services/%s существует', (file) => {
    expect(existsSync(resolve(PAGES, 'services', file))).toBe(true)
  })
})

describe('REDIRECT_FALLBACKS', () => {
  it('начинается с дашборда', () => {
    expect(REDIRECT_FALLBACKS[0]).toBe('/')
  })

  it('заканчивается на /account/profile (всегда доступен)', () => {
    expect(REDIRECT_FALLBACKS.at(-1)).toBe('/account/profile')
  })

  it('содержит /help как ungated-страховку', () => {
    expect(REDIRECT_FALLBACKS).toContain('/help')
  })

  it('каждый кандидат либо ungated, либо имеет известный гейт', () => {
    for (const path of REDIRECT_FALLBACKS) {
      const ungated = isUngatedRoute(path)
      const gate = resolveRouteGate(path)

      expect(ungated || gate !== null).toBe(true)
    }
  })

  it('не содержит дубликатов', () => {
    expect(new Set(REDIRECT_FALLBACKS).size).toBe(REDIRECT_FALLBACKS.length)
  })
})
