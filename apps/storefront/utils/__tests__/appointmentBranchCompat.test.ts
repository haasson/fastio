import { describe, it, expect } from 'vitest'
import {
  calcAppointmentBranchReset,
  type ServiceCompat,
  type ResourceCompat,
} from '../appointmentBranchCompat'
import type { ServiceCartItem } from '../../stores/cart'

const makeItem = (overrides: Partial<ServiceCartItem> = {}): ServiceCartItem => ({
  kind: 'service',
  _key: overrides._key ?? `k-${overrides.serviceId ?? 's'}`,
  serviceId: 's1',
  serviceName: 'Стрижка',
  duration: 60,
  price: 1000,
  photo: null,
  branchId: null,
  preferredResourceId: null,
  allowResourceChoice: true,
  ...overrides,
})

const branchA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const branchB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const branchC = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const svcEverywhere: ServiceCompat = { id: 's1', branchIds: [] }
const svcOnlyA: ServiceCompat = { id: 's2', branchIds: [branchA] }
const svcAB: ServiceCompat = { id: 's3', branchIds: [branchA, branchB] }

const resEverywhere: ResourceCompat = { id: 'r1', branchIds: [] }
const resOnlyA: ResourceCompat = { id: 'r2', branchIds: [branchA] }

describe('calcAppointmentBranchReset', () => {
  it('пустая корзина → пусто во всех бакетах', () => {
    const r = calcAppointmentBranchReset([], branchA, [svcEverywhere], [])
    expect(r.survivors).toEqual([])
    expect(r.dropped).toEqual([])
    expect(r.resourcesReset).toEqual([])
  })

  it('услуга везде → выживает при любом филиале', () => {
    const item = makeItem({ serviceId: 's1' })
    const r = calcAppointmentBranchReset([item], branchC, [svcEverywhere], [])
    expect(r.survivors).toEqual([item])
    expect(r.dropped).toEqual([])
  })

  it('услуга только в A → дропается при переходе в B', () => {
    const item = makeItem({ serviceId: 's2' })
    const r = calcAppointmentBranchReset([item], branchB, [svcOnlyA], [])
    expect(r.dropped).toEqual([item])
    expect(r.survivors).toEqual([])
  })

  it('услуга в A+B → выживает при B', () => {
    const item = makeItem({ serviceId: 's3' })
    const r = calcAppointmentBranchReset([item], branchB, [svcAB], [])
    expect(r.survivors).toEqual([item])
  })

  it('неизвестная услуга → fallback: считаем глобально доступной', () => {
    const item = makeItem({ serviceId: 'unknown' })
    const r = calcAppointmentBranchReset([item], branchA, [], [])
    expect(r.survivors).toEqual([item])
    expect(r.dropped).toEqual([])
  })

  it('preferredResource в A, переход в B → resourcesReset.includes serviceId', () => {
    const item = makeItem({ serviceId: 's1', preferredResourceId: 'r2' })
    const r = calcAppointmentBranchReset([item], branchB, [svcEverywhere], [resOnlyA])
    expect(r.survivors).toEqual([item])
    expect(r.resourcesReset).toEqual(['s1'])
  })

  it('preferredResource везде → не сбрасывается при смене', () => {
    const item = makeItem({ serviceId: 's1', preferredResourceId: 'r1' })
    const r = calcAppointmentBranchReset([item], branchB, [svcEverywhere], [resEverywhere])
    expect(r.resourcesReset).toEqual([])
  })

  it('forceResetAllMasters: сбрасываем мастера у ВСЕХ услуг с preferred', () => {
    const a = makeItem({ _key: 'a', serviceId: 's1', preferredResourceId: 'r1' }) // resource везде
    const b = makeItem({ _key: 'b', serviceId: 's3', preferredResourceId: 'r2' }) // resource только в A
    const c = makeItem({ _key: 'c', serviceId: 's3', preferredResourceId: null }) // без preferred
    const r = calcAppointmentBranchReset(
      [a, b, c],
      branchA,
      [svcEverywhere, svcAB],
      [resEverywhere, resOnlyA],
      { forceResetAllMasters: true },
    )
    // c — без preferred, не попадает в reset; a и b — оба сбрасываются по флагу,
    // даже если их мастер реально работает в новом филиале.
    expect(r.resourcesReset).toEqual(['s1', 's3'])
  })

  it('смешанный кейс: одна услуга дропается, другая теряет мастера', () => {
    const a = makeItem({ _key: 'a', serviceId: 's1', preferredResourceId: 'r2' }) // выживает, мастер reset
    const b = makeItem({ _key: 'b', serviceId: 's2', preferredResourceId: 'r1' }) // дропается
    const r = calcAppointmentBranchReset(
      [a, b],
      branchB,
      [svcEverywhere, svcOnlyA],
      [resEverywhere, resOnlyA],
    )
    expect(r.dropped).toEqual([b])
    expect(r.survivors).toEqual([a])
    expect(r.resourcesReset).toEqual(['s1'])
  })
})
