/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Тесты checkModuleDisable — блокировки выключения модулей при наличии активных
 * данных. Покрывает в первую очередь модуль `services` (закрыто 2026-05-04 для
 * предотвращения «осиротевших» appointments при выключении модуля).
 */

import { describe, it, expect } from 'vitest'
import { checkModuleDisable } from '../moduleToggleChecks'
import type { SiteLayout } from '@fastio/shared'

// Минимальный SiteLayout, достаточный для прохождения findDependentFeatures
// (реальная реакция на site-layout features проверяется отдельным тестом).
const emptyLayout = {
  sectionsOrder: [],
  pages: [],
} as unknown as SiteLayout

function makeApi(overrides: Record<string, any> = {}): any {
  return {
    appointments: { countActiveFuture: async () => 0 },
    orders: { list: async () => ({ total: 0 }) },
    orderStatuses: { list: async () => [] },
    reservations: { list: async () => [] },
    tables: { list: async () => [] },
    members: { countWithCustomRole: async () => 0 },
    kitchenQueue: { countActive: async () => 0 },
    banners: { list: async () => [] },
    combos: { listAllActive: async () => [] },
    addons: { list: async () => [] },
    modifiers: { list: async () => [] },
    customers: { count: async () => 0 },
    ...overrides,
  }
}

describe('checkModuleDisable — module="services"', () => {
  it('нет активных appointments → пустой массив issues (можно выключать)', async () => {
    const api = makeApi({ appointments: { countActiveFuture: async () => 0 } })

    const issues = await checkModuleDisable('services', 'tenant-A', emptyLayout, api)

    expect(issues).toEqual([])
  })

  it('есть активные appointments → blocker с количеством', async () => {
    const api = makeApi({ appointments: { countActiveFuture: async () => 5 } })

    const issues = await checkModuleDisable('services', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'blocker' })
    expect(issues[0].message).toContain('5')
    expect(issues[0].message).toMatch(/активные запис/i)
  })

  it('countActiveFuture вызывается с tenantId', async () => {
    let receivedTenantId: string | null = null
    const api = makeApi({
      appointments: {
        countActiveFuture: async (tenantId: string) => {
          receivedTenantId = tenantId

          return 0
        },
      },
    })

    await checkModuleDisable('services', 'tenant-XYZ', emptyLayout, api)

    expect(receivedTenantId).toBe('tenant-XYZ')
  })

  it('1 запись → blocker (граница: count > 0)', async () => {
    const api = makeApi({ appointments: { countActiveFuture: async () => 1 } })

    const issues = await checkModuleDisable('services', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('blocker')
  })
})

describe('checkModuleDisable — другие модули не зовут appointments.countActiveFuture', () => {
  it('module="kitchen" не дёргает appointments API', async () => {
    let appointmentsCalled = false
    const api = makeApi({
      appointments: {
        countActiveFuture: async () => {
          appointmentsCalled = true

          return 99
        },
      },
      kitchenQueue: { countActive: async () => 0 },
    })

    await checkModuleDisable('kitchen', 'tenant-A', emptyLayout, api)

    expect(appointmentsCalled).toBe(false)
  })
})

describe('checkModuleDisable — module="dineIn" (брони — часть модуля «Столы»)', () => {
  it('нет открытых столов и активных броней → пустой массив', async () => {
    const api = makeApi()

    const issues = await checkModuleDisable('dineIn', 'tenant-A', emptyLayout, api)

    expect(issues).toEqual([])
  })

  it('есть открытые столы → blocker', async () => {
    const api = makeApi({ tables: { list: async () => [{ isOpen: true }, { isOpen: false }] } })

    const issues = await checkModuleDisable('dineIn', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'blocker' })
    expect(issues[0].message).toMatch(/открытые столы/i)
  })

  it('есть активные брони → blocker с количеством', async () => {
    const api = makeApi({ reservations: { list: async () => [{}, {}, {}] } })

    const issues = await checkModuleDisable('dineIn', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'blocker' })
    expect(issues[0].message).toContain('3')
    expect(issues[0].message).toMatch(/бронирован/i)
  })

  it('открытые столы + активные брони → два блокера', async () => {
    const api = makeApi({
      tables: { list: async () => [{ isOpen: true }] },
      reservations: { list: async () => [{}, {}] },
    })

    const issues = await checkModuleDisable('dineIn', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(2)
    expect(issues.every((i: any) => i.severity === 'blocker')).toBe(true)
  })
})

describe('checkModuleDisable — структурные модули с данными → warning (не blocker)', () => {
  it('module="combos": нет комбо → пустой массив (тихо выключается)', async () => {
    const api = makeApi({ combos: { listAllActive: async () => [] } })

    const issues = await checkModuleDisable('combos', 'tenant-A', emptyLayout, api)

    expect(issues).toEqual([])
  })

  it('module="combos": есть комбо → warning с количеством', async () => {
    const api = makeApi({ combos: { listAllActive: async () => [{}, {}, {}] } })

    const issues = await checkModuleDisable('combos', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'warning' })
    expect(issues[0].message).toContain('3')
    expect(issues[0].message).toMatch(/комбо/i)
  })

  it('module="combos": 1 комбо → warning (граница count > 0)', async () => {
    const api = makeApi({ combos: { listAllActive: async () => [{}] } })

    const issues = await checkModuleDisable('combos', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('module="addons": есть добавки → warning с количеством', async () => {
    const api = makeApi({ addons: { list: async () => [{}, {}] } })

    const issues = await checkModuleDisable('addons', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'warning' })
    expect(issues[0].message).toContain('2')
    expect(issues[0].message).toMatch(/добавк/i)
  })

  it('module="addons": нет добавок → пустой массив', async () => {
    const api = makeApi({ addons: { list: async () => [] } })

    const issues = await checkModuleDisable('addons', 'tenant-A', emptyLayout, api)

    expect(issues).toEqual([])
  })

  it('module="modifiers": есть группы модификаторов → warning с количеством', async () => {
    const api = makeApi({ modifiers: { list: async () => [{}, {}, {}, {}] } })

    const issues = await checkModuleDisable('modifiers', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'warning' })
    expect(issues[0].message).toContain('4')
    expect(issues[0].message).toMatch(/модификатор/i)
  })

  it('module="customers": есть клиенты → warning с количеством', async () => {
    const api = makeApi({ customers: { count: async () => 12 } })

    const issues = await checkModuleDisable('customers', 'tenant-A', emptyLayout, api)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'warning' })
    expect(issues[0].message).toContain('12')
    expect(issues[0].message).toMatch(/клиент/i)
  })

  it('module="customers": count вызывается с tenantId', async () => {
    let receivedTenantId: string | null = null
    const api = makeApi({
      customers: {
        count: async (tenantId: string) => {
          receivedTenantId = tenantId

          return 0
        },
      },
    })

    await checkModuleDisable('customers', 'tenant-XYZ', emptyLayout, api)

    expect(receivedTenantId).toBe('tenant-XYZ')
  })

  it('module="customers": нет клиентов → пустой массив', async () => {
    const api = makeApi({ customers: { count: async () => 0 } })

    const issues = await checkModuleDisable('customers', 'tenant-A', emptyLayout, api)

    expect(issues).toEqual([])
  })
})
