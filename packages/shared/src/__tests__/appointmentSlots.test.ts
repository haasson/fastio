import { describe, it, expect } from 'vitest'
import { findGroupSlots, findGroupSlotsWithFallback } from '../utils/appointmentSlots'
import type { ResourceSlotData, AppointmentInterval } from '../types/appointment'
import type { WorkingHoursSchedule } from '../types/tenant'

// Дата в далёком будущем + UTC, чтобы не цеплять `todayInTz` фильтр прошедших слотов.
const FUTURE_DATE = '2030-06-15'
const TZ = 'UTC'

const branch10to18: WorkingHoursSchedule = {
  default: { open: '10:00', close: '18:00' },
  days: {},
}

const makeResData = (overrides: Partial<ResourceSlotData> = {}): ResourceSlotData => ({
  schedules: [],
  disabledSlots: [],
  dateOverrides: [],
  dateDisabledSlots: [],
  branchSchedule: branch10to18,
  shiftCycle: null,
  ...overrides,
})

describe('findGroupSlots', () => {
  it('одна услуга 60 мин, ресурс свободен весь день 10–18 → 15 слотов с шагом 30', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      resourceIds: ['res-A'],
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlots(items, FUTURE_DATE, slotData, appts, { slotStep: 30, timezone: TZ })

    expect(result).toHaveLength(15)
    expect(result[0].startTime).toBe('10:00')
    expect(result[result.length - 1].startTime).toBe('17:00')
    expect(result[0].schedule).toHaveLength(1)
    expect(result[0].schedule[0]).toMatchObject({
      serviceId: 'svc-1',
      resourceId: 'res-A',
      resourceName: 'Alice',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('занятый слот 10:00–11:00 не даёт стартовать в 10:00 / 10:30', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      resourceIds: ['res-A'],
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>([
      ['res-A', [{ startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' }]],
    ])

    const result = findGroupSlots(items, FUTURE_DATE, slotData, appts, { slotStep: 30, timezone: TZ })

    expect(result.find(o => o.startTime === '10:00')).toBeUndefined()
    expect(result.find(o => o.startTime === '10:30')).toBeUndefined()
    expect(result.find(o => o.startTime === '11:00')).toBeDefined()
  })

  it('две последовательные услуги 60+60 → разные ресурсы, цепочка по времени', () => {
    const items = [
      {
        serviceId: 'svc-1',
        duration: 60,
        resourceIds: ['res-A'],
        resourceNames: new Map([['res-A', 'Alice']]),
      },
      {
        serviceId: 'svc-2',
        duration: 60,
        resourceIds: ['res-B'],
        resourceNames: new Map([['res-B', 'Bob']]),
      },
    ]
    const slotData = new Map([
      ['res-A', makeResData()],
      ['res-B', makeResData()],
    ])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlots(items, FUTURE_DATE, slotData, appts, { slotStep: 30, timezone: TZ })

    // 8h рабочий день, нужно 120 мин подряд → последний возможный старт = 16:00
    expect(result[0].startTime).toBe('10:00')
    expect(result[result.length - 1].startTime).toBe('16:00')

    const first = result[0]
    expect(first.schedule).toHaveLength(2)
    expect(first.schedule[0]).toMatchObject({ resourceId: 'res-A', startTime: '10:00', endTime: '11:00' })
    expect(first.schedule[1]).toMatchObject({ resourceId: 'res-B', startTime: '11:00', endTime: '12:00' })
  })

  it('disabled-слот на дату → пропускается старт в это время', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      resourceIds: ['res-A'],
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData({
      dateDisabledSlots: [{
        id: 'd1',
        resourceId: 'res-A',
        date: FUTURE_DATE,
        slotTime: '12:00',
      }],
    })]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlots(items, FUTURE_DATE, slotData, appts, { slotStep: 30, timezone: TZ })

    expect(result.find(o => o.startTime === '12:00')).toBeUndefined()
    expect(result.find(o => o.startTime === '11:30')).toBeDefined()
    expect(result.find(o => o.startTime === '12:30')).toBeDefined()
  })

  it('day-off override на дату → ресурс не работает → пустой результат', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      resourceIds: ['res-A'],
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData({
      dateOverrides: [{
        id: 'o1',
        resourceId: 'res-A',
        date: FUTURE_DATE,
        isWorking: false,
        openTime: null,
        closeTime: null,
      }],
    })]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlots(items, FUTURE_DATE, slotData, appts, { slotStep: 30, timezone: TZ })

    expect(result).toHaveLength(0)
  })

  it('пустой items → пустой результат', () => {
    const result = findGroupSlots(
      [], FUTURE_DATE, new Map(), new Map(), { slotStep: 30, timezone: TZ },
    )
    expect(result).toHaveLength(0)
  })
})

describe('findGroupSlotsWithFallback', () => {
  const baseSettings = { slotStep: 30, timezone: TZ }

  it('без preferred у всех услуг → все entries имеют match=preferred', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      allResourceIds: ['res-A'],
      preferredResourceId: null,
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result.type).toBe('slots')
    if (result.type !== 'slots') return

    expect(result.entries.length).toBeGreaterThan(0)
    expect(result.entries.every(e => e.match === 'preferred')).toBe(true)
  })

  it('preferred занят 10:00–11:00 → в 10:00 fallback на резервного, match=any; в 11:00 — preferred', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      allResourceIds: ['res-A', 'res-B'],
      preferredResourceId: 'res-A',
      resourceNames: new Map([['res-A', 'Alice'], ['res-B', 'Bob']]),
    }]
    const slotData = new Map([
      ['res-A', makeResData()],
      ['res-B', makeResData()],
    ])
    const appts = new Map<string, AppointmentInterval[]>([
      ['res-A', [{ startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' }]],
    ])

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result.type).toBe('slots')
    if (result.type !== 'slots') return

    const at10 = result.entries.find(e => e.startTime === '10:00')!
    expect(at10).toBeDefined()
    expect(at10.match).toBe('any')
    expect(at10.schedule[0]).toMatchObject({
      resourceId: 'res-B',
      preferredResourceId: 'res-A',
      preferredResourceName: 'Alice',
    })

    const at11 = result.entries.find(e => e.startTime === '11:00')!
    expect(at11).toBeDefined()
    expect(at11.match).toBe('preferred')
    expect(at11.schedule[0]).toMatchObject({
      resourceId: 'res-A',
      preferredResourceId: null,
      preferredResourceName: null,
    })
  })

  it('суммарная длительность > рабочего дня → request_only', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 600, // 10 часов
      allResourceIds: ['res-A'],
      preferredResourceId: null,
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result).toEqual({ type: 'request_only' })
  })

  it('единственный ресурс занят целый день → entries=[]', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      allResourceIds: ['res-A'],
      preferredResourceId: null,
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>([
      ['res-A', [{
        startsAt: '2030-06-15T10:00:00.000Z',
        endsAt: '2030-06-15T18:00:00.000Z',
      }]],
    ])

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result.type).toBe('slots')
    if (result.type !== 'slots') return
    expect(result.entries).toHaveLength(0)
  })

  it('две услуги, у одной preferred занят → 10:00 entry помечен any (даже preferred-услуга нашла себе пару)', () => {
    const items = [
      {
        serviceId: 'svc-1',
        duration: 60,
        allResourceIds: ['res-A', 'res-B'],
        preferredResourceId: 'res-A',
        resourceNames: new Map([['res-A', 'Alice'], ['res-B', 'Bob']]),
      },
      {
        serviceId: 'svc-2',
        duration: 60,
        allResourceIds: ['res-C'],
        preferredResourceId: null,
        resourceNames: new Map([['res-C', 'Carol']]),
      },
    ]
    const slotData = new Map([
      ['res-A', makeResData()],
      ['res-B', makeResData()],
      ['res-C', makeResData()],
    ])
    const appts = new Map<string, AppointmentInterval[]>([
      ['res-A', [{ startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' }]],
    ])

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result.type).toBe('slots')
    if (result.type !== 'slots') return

    const at10 = result.entries.find(e => e.startTime === '10:00')!
    expect(at10.match).toBe('any')
    expect(at10.schedule[0].resourceId).toBe('res-B') // svc-1 → fallback
    expect(at10.schedule[1].resourceId).toBe('res-C') // svc-2 → C as expected

    const at11 = result.entries.find(e => e.startTime === '11:00')!
    expect(at11.match).toBe('preferred')
    expect(at11.schedule[0].resourceId).toBe('res-A')
  })

  it('entries отсортированы по startTime по возрастанию', () => {
    const items = [{
      serviceId: 'svc-1',
      duration: 60,
      allResourceIds: ['res-A'],
      preferredResourceId: null,
      resourceNames: new Map([['res-A', 'Alice']]),
    }]
    const slotData = new Map([['res-A', makeResData()]])
    const appts = new Map<string, AppointmentInterval[]>()

    const result = findGroupSlotsWithFallback(
      items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
    )

    expect(result.type).toBe('slots')
    if (result.type !== 'slots') return

    const times = result.entries.map(e => e.startTime)
    const sorted = [...times].sort()
    expect(times).toEqual(sorted)
  })
})
