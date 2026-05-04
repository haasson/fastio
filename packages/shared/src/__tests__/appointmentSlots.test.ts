import { describe, it, expect } from 'vitest'
import {
  findGroupSlots,
  findGroupSlotsWithFallback,
  getResourceSlotsForDate,
  mergeResourceSlots,
} from '../utils/appointmentSlots'
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
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
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
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ, 2)
    expect(slots).toContain('10:00')
  })

  it('capacity=2, занято 2 параллельные записи → слот занят', () => {
    const data = makeResData()
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' },
      { startsAt: '2030-06-15T10:00:00.000Z', endsAt: '2030-06-15T11:00:00.000Z' },
    ]
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ, 2)
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
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).toEqual([])
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
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).toEqual(['13:00', '13:30', '14:00'])
  })

  it('shift cycle: активные слоты включены, между ними disabled (известный техдолг — после последнего активного слота окно не закрывается)', () => {
    // Цикл 4 дня. День 0 имеет активные слоты [09:00, 10:00, 11:00].
    // Между ними (09:30, 10:30) blocked. После 11:00 окно остаётся открытым
    // до closeTime=23:59 (см. TECHDEBT по shift-cycle disable).
    const data = makeResData({
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 4,
        slotsByDayIndex: {
          0: ['09:00', '10:00', '11:00'],
          1: ['09:00', '10:00', '11:00'],
          2: [],
          3: [],
        },
      },
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    // Активные включены, disabled между ними не отдаются.
    expect(slots).toContain('09:00')
    expect(slots).toContain('10:00')
    expect(slots).toContain('11:00')
    expect(slots).not.toContain('09:30')
    expect(slots).not.toContain('10:30')
  })

  it('shift cycle: день вне рабочего цикла (idx=2) → пустой результат', () => {
    // FUTURE_DATE — день 0; берём дату через 2 дня → idx=2.
    const data = makeResData({
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 4,
        slotsByDayIndex: { 0: ['09:00'], 1: ['09:00'], 2: [], 3: [] },
      },
    })
    const slots = getResourceSlotsForDate('2030-06-17', data, [], 60, settings.slotStep, TZ)
    expect(slots).toEqual([])
  })

  it('disabled slot на дату → исключён', () => {
    const data = makeResData({
      dateDisabledSlots: [{
        id: 'd1', resourceId: 'r', date: FUTURE_DATE, slotTime: '12:00',
      }],
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
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
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).not.toContain('13:00')
  })

  it('overnight schedule (close <= open) → пустой результат (план 1a, не поддерживается)', () => {
    // Документируем текущее поведение: 22:00–02:00 не работает. Тест защищает
    // от случайной регрессии до того как 1a будет реализован.
    const data = makeResData({
      schedules: [{
        id: 's1', resourceId: 'r', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '02:00',
      }],
      branchSchedule: null,
    })
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, [], 60, settings.slotStep, TZ)
    expect(slots).toEqual([])
  })

  it('частичное перекрытие: занятая запись 10:30–11:30 блокирует слоты 10:00, 10:30, 11:00', () => {
    const data = makeResData()
    const appts: AppointmentInterval[] = [
      { startsAt: '2030-06-15T10:30:00.000Z', endsAt: '2030-06-15T11:30:00.000Z' },
    ]
    const slots = getResourceSlotsForDate(FUTURE_DATE, data, appts, 60, settings.slotStep, TZ)
    expect(slots).not.toContain('10:00') // 10:00–11:00 пересекается с 10:30–11:30
    expect(slots).not.toContain('10:30') // 10:30–11:30 — сама занятая запись
    expect(slots).not.toContain('11:00') // 11:00–12:00 пересекается до 11:30
    expect(slots).toContain('11:30')
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

    const slots = mergeResourceSlots(
      FUTURE_DATE,
      [
        { data: dataA, appointments: [] },
        { data: dataB, appointments: [] },
      ],
      60, 30, TZ,
    )
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

    const slots = mergeResourceSlots(
      FUTURE_DATE,
      [
        { data: dataA, appointments: [] },
        { data: dataB, appointments: [] },
      ],
      60, 30, TZ,
    )
    // 10:00, 10:30, 11:00 (от обоих, но без дубля), 11:30, 12:00 (только B)
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00'])
  })
})
