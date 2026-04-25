import { describe, it, expect } from 'vitest'
import { resolveRouteGate, isUngatedRoute, REDIRECT_FALLBACKS } from '../plan/useGate.routes'

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
      ['/menu', 'manageMenu'],
      ['/orders', 'viewOrders'],
      ['/kitchen', 'viewKitchen'],
      ['/tables', 'viewTables'],
      ['/reservations', 'viewReservations'],
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

    it('/menu/dishes → manageMenu (унаследовано от /menu)', () => {
      expect(resolveRouteGate('/menu/dishes')).toBe('manageMenu')
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
