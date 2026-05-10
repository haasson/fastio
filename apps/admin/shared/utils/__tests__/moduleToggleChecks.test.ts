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

  it('module="reservations" не дёргает appointments API', async () => {
    let appointmentsCalled = false
    const api = makeApi({
      appointments: {
        countActiveFuture: async () => {
          appointmentsCalled = true

          return 99
        },
      },
    })

    await checkModuleDisable('reservations', 'tenant-A', emptyLayout, api)

    expect(appointmentsCalled).toBe(false)
  })
})
