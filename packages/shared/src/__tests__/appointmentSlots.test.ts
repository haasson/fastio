import { describe, it, expect } from 'vitest'
import {
  findGroupSlots,
  findGroupSlotsWithFallback,
  getResourceSlotsForDate,
  mergeResourceSlots,
  type SlotEntry,
} from '../utils/appointmentSlots'
import type { ResourceSlotData, AppointmentInterval } from '../types/appointment'
import type { WorkingHoursSchedule } from '../types/tenant'

/** Маппит SlotEntry[] → массив строк HH:MM (для совместимости со старыми ассертами). */
const times = (entries: SlotEntry[]): string[] => entries.map((e) => e.time)

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

  it('две услуги, у одной preferred занят, но перестановка даёт preferred → 10:00 entry помечен preferred', () => {
    // res-A занят 10:00–11:00. В исходном порядке [svc-1, svc-2] на 10:00:
    // svc-1 нужен res-A (preferred) → недоступен → fallback на res-B. Это any.
    // Но перестановка [svc-2, svc-1] на 10:00: res-C делает svc-2, в 11:00
    // res-A освободился и делает svc-1 → preferred OK. Алгоритм 10.1 берёт лучший.
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
    expect(at10.match).toBe('preferred')
    // Schedule в порядке выполнения после перестановки: svc-2 первым.
    expect(at10.schedule[0]).toMatchObject({ serviceId: 'svc-2', resourceId: 'res-C', startTime: '10:00' })
    expect(at10.schedule[1]).toMatchObject({ serviceId: 'svc-1', resourceId: 'res-A', startTime: '11:00' })

    const at11 = result.entries.find(e => e.startTime === '11:00')!
    expect(at11.match).toBe('preferred')
    expect(at11.schedule[0].resourceId).toBe('res-A')
  })

  // План 1a: групповая бронь поддерживает overnight (close < open) — 2 услуги
  // могут размазаться через полночь, schedule entries получают isNextDay флаги.
  describe('overnight в группе (план 1a)', () => {
    it('overnight schedule 22:00→04:00, 2 услуги по 60 мин → стартовый слот 23:00 размазывает на D и D+1', () => {
      const data = makeResData({
        schedules: [{
          id: '', resourceId: 'res-A', dayOfWeek: 6,
          isWorking: true, openTime: '22:00', closeTime: '04:00',
        }],
        branchSchedule: null,
      })
      const items = [
        {
          serviceId: 'svc-1',
          duration: 60,
          allResourceIds: ['res-A'],
          preferredResourceId: null,
          resourceNames: new Map([['res-A', 'Alice']]),
        },
        {
          serviceId: 'svc-2',
          duration: 60,
          allResourceIds: ['res-A'],
          preferredResourceId: null,
          resourceNames: new Map([['res-A', 'Alice']]),
        },
      ]
      const slotData = new Map([['res-A', data]])
      const appts = new Map<string, AppointmentInterval[]>()

      const result = findGroupSlotsWithFallback(
        items, FUTURE_DATE, slotData, appts, baseSettings, 6 * 60, null,
      )

      expect(result.type).toBe('slots')
      if (result.type !== 'slots') return

      // Стартовые слоты: 22:00, 22:30, 23:00, 23:30, 00:00 D+1, 00:30 D+1, 01:00 D+1, 01:30 D+1.
      // Последний возможный старт — 02:00 D+1 (cursor + 120 = 04:00 ровно close).
      // Реально: t от 22*60=1320 до closeMinAdj-totalDur=1680-120=1560 включительно.
      // Шаг 30: 1320,1350,1380,1410,1440,1470,1500,1530,1560 → 9 слотов.
      expect(result.entries).toHaveLength(9)

      // Слот 23:00 — старт на D, вторая услуга на D+1.
      const at23 = result.entries.find((e) => e.startTime === '23:00' && !e.startIsNextDay)
      expect(at23).toBeDefined()
      expect(at23!.schedule[0]).toMatchObject({
        startTime: '23:00', startIsNextDay: false,
        endTime: '00:00', endIsNextDay: true,
      })
      expect(at23!.schedule[1]).toMatchObject({
        startTime: '00:00', startIsNextDay: true,
        endTime: '01:00', endIsNextDay: true,
      })

      // Слот 02:00 D+1 — оба item'а полностью в D+1.
      const at0200Next = result.entries.find((e) => e.startTime === '02:00' && e.startIsNextDay)
      expect(at0200Next).toBeDefined()
      expect(at0200Next!.schedule[0]).toMatchObject({ startTime: '02:00', startIsNextDay: true, endTime: '03:00', endIsNextDay: true })
      expect(at0200Next!.schedule[1]).toMatchObject({ startTime: '03:00', startIsNextDay: true, endTime: '04:00', endIsNextDay: true })
    })

    it('findGroupSlotsWithFallback overnight: preferred-fallback корректно работает через полночь', () => {
      // Услуга 1 — preferred res-A, услуга 2 — preferred res-B. Оба ресурса работают
      // 22:00→04:00. На 23:00 res-A занят бронью 23:00→00:00 → у svc-1 fallback на res-B.
      // Перестановка может найти slot когда другой order даёт preferred.
      const data: ResourceSlotData = {
        schedules: [{
          id: '', resourceId: 'res-A', dayOfWeek: 6,
          isWorking: true, openTime: '22:00', closeTime: '04:00',
        }],
        disabledSlots: [], dateOverrides: [], dateDisabledSlots: [],
        branchSchedule: null, shiftCycle: null,
      }
      const dataB: ResourceSlotData = {
        ...data,
        schedules: [{ id: '', resourceId: 'res-B', dayOfWeek: 6, isWorking: true, openTime: '22:00', closeTime: '04:00' }],
      }
      const items = [{
        serviceId: 'svc-1',
        duration: 60,
        allResourceIds: ['res-A', 'res-B'],
        preferredResourceId: 'res-A',
        resourceNames: new Map([['res-A', 'Alice'], ['res-B', 'Bob']]),
      }]
      const slotData = new Map([['res-A', data], ['res-B', dataB]])
      const appts = new Map<string, AppointmentInterval[]>([
        ['res-A', [{ startsAt: '2030-06-15T23:00:00.000Z', endsAt: '2030-06-16T00:00:00.000Z' }]],
      ])

      const result = findGroupSlotsWithFallback(
        items, FUTURE_DATE, slotData, appts, baseSettings, 6 * 60, null,
      )

      expect(result.type).toBe('slots')
      if (result.type !== 'slots') return

      // Слот 23:00 — res-A занят, fallback на res-B → match='any'.
      const at23 = result.entries.find((e) => e.startTime === '23:00' && !e.startIsNextDay)
      expect(at23).toBeDefined()
      expect(at23!.match).toBe('any')
      expect(at23!.schedule[0].resourceId).toBe('res-B')

      // Слот 00:00 D+1 — res-A уже свободен → match='preferred'.
      const at00next = result.entries.find((e) => e.startTime === '00:00' && e.startIsNextDay)
      expect(at00next).toBeDefined()
      expect(at00next!.match).toBe('preferred')
      expect(at00next!.schedule[0].resourceId).toBe('res-A')
    })

    it('overnight + бронь 23:00→00:00 у мастера → слоты 22:30 / 23:00 / 23:30 заблокированы', () => {
      const data = makeResData({
        schedules: [{
          id: '', resourceId: 'res-A', dayOfWeek: 6,
          isWorking: true, openTime: '22:00', closeTime: '04:00',
        }],
        branchSchedule: null,
      })
      const items = [
        {
          serviceId: 'svc-1',
          duration: 60,
          allResourceIds: ['res-A'],
          preferredResourceId: null,
          resourceNames: new Map([['res-A', 'Alice']]),
        },
      ]
      const slotData = new Map([['res-A', data]])
      const appts = new Map<string, AppointmentInterval[]>([
        ['res-A', [{ startsAt: '2030-06-15T23:00:00.000Z', endsAt: '2030-06-16T00:00:00.000Z' }]],
      ])

      const result = findGroupSlotsWithFallback(
        items, FUTURE_DATE, slotData, appts, baseSettings, 6 * 60, null,
      )

      expect(result.type).toBe('slots')
      if (result.type !== 'slots') return

      // 22:30 (22:30→23:30 пересекается), 23:00, 23:30 — заняты. 22:00 свободен (22:00→23:00, конец = старт занятого), 00:00 D+1 — свободен.
      const present = (time: string, nextDay: boolean) => result.entries.find((e) => e.startTime === time && e.startIsNextDay === nextDay)
      expect(present('22:00', false)).toBeDefined()
      expect(present('22:30', false)).toBeUndefined()
      expect(present('23:00', false)).toBeUndefined()
      expect(present('23:30', false)).toBeUndefined()
      expect(present('00:00', true)).toBeDefined()
    })
  })

  // 10.1: алгоритм перебирает все перестановки услуг при items.length<=5,
  // чтобы найти стартовые времена недоступные в исходном порядке.
  describe('перестановки услуг (план 10.1)', () => {
    it('Маша занята-свободна, Лена свободна-занята → 10:00 находится через перестановку', () => {
      // Услуги "брови" и "ногти", по 60 мин каждая.
      // res-Masha: занята 10:00–11:00 → может делать только 2-ю по времени.
      // res-Lena: занята 11:00–12:00 → может делать только 1-ю по времени.
      // Исходный порядок [brows→Masha, nails→Lena]: на 10:00 Маша занята → fail.
      // Перестановка [nails→Lena, brows→Masha]: на 10:00 Лена делает ногти,
      // в 11:00 Маша уже свободна на брови → ok.
      const items = [
        {
          serviceId: 'brows',
          duration: 60,
          allResourceIds: ['res-Masha'],
          preferredResourceId: 'res-Masha',
          resourceNames: new Map([['res-Masha', 'Маша']]),
        },
        {
          serviceId: 'nails',
          duration: 60,
          allResourceIds: ['res-Lena'],
          preferredResourceId: 'res-Lena',
          resourceNames: new Map([['res-Lena', 'Лена']]),
        },
      ]
      const slotData = new Map([
        ['res-Masha', makeResData()],
        ['res-Lena', makeResData()],
      ])
      const appts = new Map<string, AppointmentInterval[]>([
        ['res-Masha', [{ startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' }]],
        ['res-Lena', [{ startsAt: '2030-06-15T11:00:00.000Z', endsAt: '2030-06-15T12:00:00.000Z' }]],
      ])

      const result = findGroupSlotsWithFallback(
        items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
      )

      expect(result.type).toBe('slots')
      if (result.type !== 'slots') return

      const at10 = result.entries.find(e => e.startTime === '10:00')
      expect(at10).toBeDefined()
      expect(at10!.match).toBe('preferred')

      // Schedule в порядке выполнения (по времени): сначала ногти, потом брови.
      expect(at10!.schedule[0]).toMatchObject({
        serviceId: 'nails',
        resourceId: 'res-Lena',
        startTime: '10:00',
        endTime: '11:00',
      })
      expect(at10!.schedule[1]).toMatchObject({
        serviceId: 'brows',
        resourceId: 'res-Masha',
        startTime: '11:00',
        endTime: '12:00',
      })
    })

    it('preferred-вариант перебивает any: один порядок даёт preferred, другой any', () => {
      // Маша делает обе услуги (универсал), Лена только ногти.
      // [brows→Masha, nails→either]: на 10:00 Маша делает брови, на 11:00 любой делает ногти.
      // [nails→either, brows→Masha]: на 10:00 любой делает ногти, на 11:00 Маша делает брови.
      // У Маши есть «брови» только как preferred. Если Маша занята 11:00–12:00,
      // то [brows→Masha(10), nails→Lena(11)] = preferred. [nails→Lena(10), brows→Masha(11)] = fail.
      // Цель: убедиться что bestByStart хранит preferred-варианты при наличии.
      const items = [
        {
          serviceId: 'brows',
          duration: 60,
          allResourceIds: ['res-Masha'],
          preferredResourceId: 'res-Masha',
          resourceNames: new Map([['res-Masha', 'Маша']]),
        },
        {
          serviceId: 'nails',
          duration: 60,
          allResourceIds: ['res-Lena'],
          preferredResourceId: null,
          resourceNames: new Map([['res-Lena', 'Лена']]),
        },
      ]
      const slotData = new Map([
        ['res-Masha', makeResData()],
        ['res-Lena', makeResData()],
      ])
      const appts = new Map<string, AppointmentInterval[]>([
        ['res-Masha', [{ startsAt: '2030-06-15T11:00:00.000Z', endsAt: '2030-06-15T12:00:00.000Z' }]],
      ])

      const result = findGroupSlotsWithFallback(
        items, FUTURE_DATE, slotData, appts, baseSettings, 8 * 60, branch10to18,
      )

      expect(result.type).toBe('slots')
      if (result.type !== 'slots') return

      const at10 = result.entries.find(e => e.startTime === '10:00')
      expect(at10).toBeDefined()
      // Должен быть preferred (порядок brows→nails работает: 10:00 Маша, 11:00 Лена).
      expect(at10!.match).toBe('preferred')
    })

    it('items.length=1 → перестановки не пробуются (не должны ломать одиночный случай)', () => {
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

      // 8h рабочий день / 60 мин услуга / шаг 30 = 15 слотов 10:00..17:00.
      expect(result.entries).toHaveLength(15)
      expect(result.entries.every(e => e.match === 'preferred')).toBe(true)
    })
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

// План 1.1: расширенное покрытие низкоуровневых функций (capacity, shift cycle,
// dateOverrides priority, disabled slots, today-cutoff, merge).
describe('getResourceSlotsForDate', () => {
  const settings = { slotStep: 30, timezone: TZ }

  it('capacity=1, ресурс свободен → 8 слотов 60-мин услуги в 8h окне', () => {
    const data = makeResData()
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    // 10:00..17:00 шагом 30 мин = 15 слотов; последний слот 17:00 кончается в 18:00.
    expect(slots).toHaveLength(15)
    expect(slots[0]).toBe('10:00')
    expect(slots[slots.length - 1]).toBe('17:00')
  })

  it('capacity=2, занято 1 запись → слот всё ещё доступен', () => {
    const data = makeResData()
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' },
    ]
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ, 2))
    expect(slots).toContain('10:00')
  })

  it('capacity=2, занято 2 параллельные записи → слот занят', () => {
    const data = makeResData()
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' },
      { startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' },
    ]
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ, 2))
    expect(slots).not.toContain('10:00')
    // 10:30 пересекается с обеими — тоже занят. 11:00 свободен.
    expect(slots).not.toContain('10:30')
    expect(slots).toContain('11:00')
  })

  it('capacity=0 (невалидный) → пустой результат, не крашится', () => {
    const data = makeResData()
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ, 0)
    expect(slots).toEqual([])
  })

  it('day-off override → пустой результат (override приоритетнее weekly)', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6, // 2030-06-15 это суббота
        isWorking: true, openTime: '09:00', closeTime: '17:00',
      }],
      dateOverrides: [{
        id: 'o1', resourceId: 'r', date: FUTURE_DATE,
        isWorking: false, openTime: null, closeTime: null,
      }],
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    expect(slots).toEqual([])
  })

  it('24/7 филиал + ресурс без своего графика → 47 слотов 00:00..23:00 (duration=60, последний влезает в 24:00 границу)', () => {
    const data = makeResData({
      branchSchedule: { default: { open: '00:00', close: '00:00', allDay: true }, days: {} },
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    // 24h окно / 30 мин шаг = 48 стартовых моментов. duration=60 отсекает
    // 23:30 (закончится в 00:30 D+1 = вне окна). Остаётся 47: 00:00..23:00.
    expect(slots).toHaveLength(47)
    expect(slots[0]).toEqual({ time: '00:00', isNextDay: false })
    expect(slots[slots.length - 1]).toEqual({ time: '23:00', isNextDay: false })
    // Все слоты в фазе D — overnight не активен (окно [00:00, 24:00) полностью в D).
    expect(slots.every((s) => !s.isNextDay)).toBe(true)
  })

  it('24/7 филиал + ресурс задан 00:00→00:00 (свой 24/7) → то же 47 слотов (без overnight-фазы)', () => {
    const data = makeResData({
      branchSchedule: { default: { open: '00:00', close: '00:00', allDay: true }, days: {} },
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '00:00', closeTime: '00:00',
      }],
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).toHaveLength(47)
    expect(slots.every((s) => !s.isNextDay)).toBe(true)
  })

  it('working override на дату → перебивает обычный график (другие часы)', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '09:00', closeTime: '17:00',
      }],
      dateOverrides: [{
        id: 'o1', resourceId: 'r', date: FUTURE_DATE,
        isWorking: true, openTime: '13:00', closeTime: '15:00',
      }],
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    expect(slots).toEqual(['13:00', '13:30', '14:00'])
  })

  it('shift cycle: рабочий день цикла → ровно слоты от open до close (без техдолга про дырку)', () => {
    // Цикл 4 дня. День 0 — рабочий 09:00–12:00. branchSchedule=null чтобы
    // не наложилось окно филиала и не уменьшило фактический интервал.
    const data = makeResData({
      branchSchedule: null,
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 4,
        hoursByDayIndex: {
          0: { openTime: '09:00', closeTime: '12:00' },
          1: { openTime: '09:00', closeTime: '12:00' },
          2: null,
          3: null,
        },
      },
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    // 09:00..11:00 (последний слот 11:00→12:00 умещается в окно).
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })

  it('shift cycle: день вне рабочего цикла (idx=2 = выходной) → пустой результат', () => {
    // FUTURE_DATE — день 0; берём дату через 2 дня → idx=2 = выходной.
    const data = makeResData({
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 4,
        hoursByDayIndex: {
          0: { openTime: '09:00', closeTime: '17:00' },
          1: { openTime: '09:00', closeTime: '17:00' },
          2: null,
          3: null,
        },
      },
    })
    const slots = times(getResourceSlotsForDate('2030-06-17', data, [], 60, settings.slotStep, TZ))
    expect(slots).toEqual([])
  })

  it('shift cycle: hoursByDayIndex с close < open (overnight) → slot engine материализует overnight-фазу', () => {
    // Смена 22:00→02:00. branchSchedule=null чтобы окно филиала не отрезало
    // overnight (см. отдельные тесты на пересечение с филиалом).
    const data = makeResData({
      branchSchedule: null,
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 2,
        hoursByDayIndex: {
          0: { openTime: '22:00', closeTime: '02:00' },
          1: null,
        },
      },
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).toEqual([
      { time: '22:00', isNextDay: false },
      { time: '22:30', isNextDay: false },
      { time: '23:00', isNextDay: false },
      { time: '23:30', isNextDay: false },
      { time: '00:00', isNextDay: true },
      { time: '00:30', isNextDay: true },
      { time: '01:00', isNextDay: true },
    ])
  })

  it('disabled slot на дату → исключён', () => {
    const data = makeResData({
      dateDisabledSlots: [{
        id: 'd1', resourceId: 'r', date: FUTURE_DATE, slotTime: '12:00',
      }],
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    expect(slots).not.toContain('12:00')
    expect(slots).toContain('11:30')
  })

  it('weekly disabled slot (dayOfWeek) → исключён по дню недели', () => {
    const data = makeResData({
      // 2030-06-15 — суббота, dayOfWeek=6.
      disabledSlots: [{
        id: 'd1', resourceId: 'r', dayOfWeek: 6, slotTime: '13:00',
      }],
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    expect(slots).not.toContain('13:00')
  })

  it('overnight weekly schedule (22:00→02:00) — материализует слоты с isNextDay для D+1 фазы', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '02:00',
      }],
      branchSchedule: null,
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    // 22:00, 22:30, 23:00, 23:30 — день D; 00:00, 00:30, 01:00 — день D+1.
    expect(slots).toEqual([
      { time: '22:00', isNextDay: false },
      { time: '22:30', isNextDay: false },
      { time: '23:00', isNextDay: false },
      { time: '23:30', isNextDay: false },
      { time: '00:00', isNextDay: true },
      { time: '00:30', isNextDay: true },
      { time: '01:00', isNextDay: true },
    ])
  })

  it('overnight + booked appointment 23:00→00:00 → слоты 22:30, 23:00 заняты', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '02:00',
      }],
      branchSchedule: null,
    })
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T23:00:00.000Z', endsAt: '2030-06-16T00:00:00.000Z' },
    ]
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ)
    const taken = ['22:30', '23:00', '23:30']
    for (const t of taken) {
      expect(slots.find((s) => s.time === t)).toBeUndefined()
    }
    expect(slots.find((s) => s.time === '22:00' && !s.isNextDay)).toBeDefined()
    expect(slots.find((s) => s.time === '00:00' && s.isNextDay)).toBeDefined()
  })

  it('пересечение с филиалом: мастер 22-04 при филиале 10-22 → 0 слотов', () => {
    // Юзер-кейс: ресурсу выставлен ночной график, но заведение закрывается в 22.
    // Без пересечения раньше отдавались слоты ночью «вне» филиала.
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '04:00',
      }],
      // makeResData по дефолту branch10to18 (10–18). Перебиваем на 10–22 для теста.
      branchSchedule: { default: { open: '10:00', close: '22:00' }, days: {} },
    })
    expect(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)).toEqual([])
  })

  it('пересечение с филиалом: мастер 09-20 при филиале 10-18 → слоты 10:00..17:00', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '09:00', closeTime: '20:00',
      }],
    })
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ))
    expect(slots[0]).toBe('10:00')
    expect(slots[slots.length - 1]).toBe('17:00')
  })

  it('пересечение с филиалом: филиал 24/7 (allDay) → не урезает overnight ресурс', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '02:00',
      }],
      branchSchedule: { default: { open: '00:00', close: '00:00', allDay: true }, days: {} },
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    // Полные 4 часа смены = 22:00, 22:30, 23:00, 23:30 + 00:00 (D+1), 00:30, 01:00.
    expect(slots).toHaveLength(7)
    expect(slots.find((s) => s.time === '00:00' && s.isNextDay)).toBeDefined()
  })

  it('пересечение с филиалом: филиал в этот день закрыт (dayOff) → 0 слотов даже если у ресурса свой график', () => {
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '10:00', closeTime: '17:00',
      }],
      branchSchedule: {
        default: { open: '10:00', close: '18:00' },
        // 2030-06-15 — суббота, isoDay=6.
        days: { '6': { dayOff: true, open: '', close: '' } },
      },
    })
    expect(getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)).toEqual([])
  })

  it('частичное перекрытие: занятая запись 10:30–11:30 блокирует слоты 10:00, 10:30, 11:00', () => {
    const data = makeResData()
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T10:30:00.000Z', endsAt: '2030-06-15T11:30:00.000Z' },
    ]
    const slots = times(getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ))
    expect(slots).not.toContain('10:00') // 10:00–11:00 пересекается с 10:30–11:30
    expect(slots).not.toContain('10:30') // 10:30–11:30 — сама занятая запись
    expect(slots).not.toContain('11:00') // 11:00–12:00 пересекается до 11:30
    expect(slots).toContain('11:30')
  })
})

describe('resource unavailability — план 10.7', () => {
  // Каркас ResourceUnavailability — поля даты используются в matcher, остальное
  // не влияет на resolveResourceWorkingHours.
  const makeUnavail = (dateFrom: string, dateTo: string) => ({
    id: 'u-1',
    tenantId: 't-1',
    resourceId: 'R',
    dateFrom,
    dateTo,
    reason: 'vacation' as const,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  })

  it('дата внутри отпуска → нет слотов, даже при специальном dateOverride', () => {
    // Override на этот же день с явным is_working=true. Unavailability должен перебить.
    const data = makeResData({
      dateOverrides: [{
        id: 'o-1', resourceId: 'R', date: FUTURE_DATE,
        isWorking: true, openTime: '08:00', closeTime: '20:00',
      }],
      unavailability: [makeUnavail(FUTURE_DATE, FUTURE_DATE)],
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, 30, TZ)
    expect(slots).toEqual([])
  })

  it('дата ВНЕ периода отпуска → слоты есть как обычно', () => {
    const data = makeResData({
      unavailability: [makeUnavail('2030-06-10', '2030-06-14')], // Юзер выходит 15-го
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, 60, TZ)
    expect(slots.length).toBeGreaterThan(0)
  })

  it('диапазон отпуска включает start и end (inclusive)', () => {
    const data = makeResData({
      unavailability: [makeUnavail('2030-06-10', '2030-06-15')],
    })
    // 10-го (start) — нет слотов
    const slotsStart = getResourceSlotsForDate('2030-06-10', data, [], 60, 60, TZ)
    // 15-го (end inclusive) — нет слотов
    const slotsEnd = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, 60, TZ)
    expect(slotsStart).toEqual([])
    expect(slotsEnd).toEqual([])
  })

  it('пересечение нескольких периодов unavailability — любое попадание блокирует', () => {
    const data = makeResData({
      unavailability: [
        makeUnavail('2030-06-01', '2030-06-05'),
        makeUnavail('2030-06-14', '2030-06-16'),
      ],
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, 60, TZ)
    expect(slots).toEqual([])
  })

  it('пустой массив unavailability ведёт себя как отсутствие — слоты есть', () => {
    const data = makeResData({ unavailability: [] })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, 60, TZ)
    expect(slots.length).toBeGreaterThan(0)
  })
})

describe('mergeResourceSlots', () => {
  it('два ресурса: объединение и сортировка слотов', () => {
    // res-A работает 10:00-12:00 (override), res-B 14:00-16:00 (override).
    const dataA = makeResData({
      dateOverrides: [{
        id: 'o-A', resourceId: 'A', date: FUTURE_DATE,
        isWorking: true, openTime: '10:00', closeTime: '12:00',
      }],
    })
    const dataB = makeResData({
      dateOverrides: [{
        id: 'o-B', resourceId: 'B', date: FUTURE_DATE,
        isWorking: true, openTime: '14:00', closeTime: '16:00',
      }],
    })

    const slots = times(mergeResourceSlots(
      FUTURE_DATE,
      [
        { data: dataA, appointments: [] },
        { data: dataB, appointments: [] },
      ],
      60, 30, TZ,
    ))
    expect(slots).toEqual(['10:00', '10:30', '11:00', '14:00', '14:30', '15:00'])
  })

  it('перекрывающиеся ресурсы: общий слот не дублируется', () => {
    // Два ресурса 10–12 и 11–13 → общий слот 11:00 встречается один раз.
    const dataA = makeResData({
      dateOverrides: [{
        id: 'o-A', resourceId: 'A', date: FUTURE_DATE,
        isWorking: true, openTime: '10:00', closeTime: '12:00',
      }],
    })
    const dataB = makeResData({
      dateOverrides: [{
        id: 'o-B', resourceId: 'B', date: FUTURE_DATE,
        isWorking: true, openTime: '11:00', closeTime: '13:00',
      }],
    })

    const slots = times(mergeResourceSlots(
      FUTURE_DATE,
      [
        { data: dataA, appointments: [] },
        { data: dataB, appointments: [] },
      ],
      60, 30, TZ,
    ))
    // 10:00, 10:30, 11:00 (от обоих, но без дубля), 11:30, 12:00 (только B)
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00'])
  })
})
