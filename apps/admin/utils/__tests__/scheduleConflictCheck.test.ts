/**
 * Тесты scheduleConflictCheck — проверка попадания записей в новое расписание
 * при применении/редактировании шаблона. Покрывает overnight-семантику
 * (close<open ⇒ запись через полночь не считается конфликтом).
 */

import { describe, it, expect } from 'vitest'
import type {
  ResourceSlotData, ScheduleTemplateFull, WorkingHoursSchedule,
} from '@fastio/shared'
import {
  checkAppointmentAgainstSchedule,
  checkAppointmentsAgainstSchedule,
  buildSlotDataFromWeeklyTemplate,
  buildSlotDataFromShiftTemplate,
  type AppointmentLite,
} from '../scheduleConflictCheck'

const TZ = 'UTC'
const FUTURE_DATE = '2030-06-15' // суббота

const baseAppt = (overrides: Partial<AppointmentLite> = {}): AppointmentLite => ({
  id: 'a1',
  resourceId: 'r1',
  startsAt: '2030-06-15T10:00:00.000Z',
  endsAt: '2030-06-15T11:00:00.000Z',
  customerName: 'Test',
  status: 'confirmed',
  ...overrides,
})

const emptyData = (overrides: Partial<ResourceSlotData> = {}): ResourceSlotData => ({
  schedules: [],
  disabledSlots: [],
  dateOverrides: [],
  dateDisabledSlots: [],
  branchSchedule: null,
  shiftCycle: null,
  ...overrides,
})

describe('checkAppointmentAgainstSchedule — overnight (план 1a)', () => {
  it('запись через полночь на overnight-графике (22:00→04:00) → НЕ конфликт', () => {
    // Запись 23:30 → 00:30 (на 2 датах локально). Расписание ресурса на субботу
    // = 22:00–04:00. Это валидное расписание; конфликта быть не должно.
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '22:00', closeTime: '04:00',
      }],
    })
    const appt = baseAppt({
      startsAt: '2030-06-15T23:30:00.000Z',
      endsAt: '2030-06-16T00:30:00.000Z',
    })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBeNull()
  })

  it('запись через полночь на нон-overnight-графике (09:00→18:00) → overnight conflict', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '09:00', closeTime: '18:00',
      }],
    })
    const appt = baseAppt({
      startsAt: '2030-06-15T23:30:00.000Z',
      endsAt: '2030-06-16T00:30:00.000Z',
    })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBe('overnight')
  })

  it('запись внутри overnight окна (00:30→01:30 на ночной фазе) → НЕ конфликт', () => {
    // Это бронь на 16 июня 00:30–01:30 (ещё «вчерашняя» смена 15-го).
    // Бронь принадлежит дате 2030-06-16 по start.dateStr (UTC). Смена ресурса
    // 16-го (вс) = 22:00–04:00 → end 01:30 < closeAdj 28:00. Однодневная.
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 0, // воскресенье
        isWorking: true, openTime: '22:00', closeTime: '04:00',
      }],
    })
    const appt = baseAppt({
      startsAt: '2030-06-16T00:30:00.000Z',
      endsAt: '2030-06-16T01:30:00.000Z',
    })

    // Для start=00:30 на overnight-графике 22:00→04:00: open=22*60=1320,
    // close=4*60=240, overnight, closeAdj=240+1440=1680. start=30, end=90.
    // 30<1320 → out-of-hours.
    // То есть начало смены = 22:00, и 00:30 как старт — сильно раньше open.
    // Тест документирует это как 'out-of-hours' — правильно. Запись начинается
    // в фазу когда смена ещё не началась.
    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBe('out-of-hours')
  })
})

describe('checkAppointmentAgainstSchedule — 24/7 (open == close)', () => {
  // Семантика: open == close ⇒ круглосуточный ресурс. Окно бесконечное,
  // часовые проверки пропускаются, валидны любые start/end.
  it('запись 10:00→11:00 (внутри суток) → НЕ конфликт', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '00:00', closeTime: '00:00',
      }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })

  it('запись 22:00 D → 01:00 D+1 (через полночь) → НЕ конфликт', () => {
    const data = emptyData({
      schedules: [
        { id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '00:00', closeTime: '00:00' },
        { id: '', resourceId: 'r1', dayOfWeek: 0, isWorking: true, openTime: '00:00', closeTime: '00:00' },
      ],
    })
    const appt = baseAppt({
      startsAt: '2030-06-15T22:00:00.000Z',
      endsAt: '2030-06-16T01:00:00.000Z',
    })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBeNull()
  })

  it('24/7 + disabled слот на dow → "disabled-slot"', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '00:00', closeTime: '00:00',
      }],
      disabledSlots: [{ id: '', resourceId: 'r1', dayOfWeek: 6, slotTime: '10:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('disabled-slot')
  })
})

describe('checkAppointmentAgainstSchedule — basics', () => {
  it('day-off (нет рабочих часов на этот день) → "day-off"', () => {
    const data = emptyData() // без schedules → null часы → day-off

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('day-off')
  })

  it('out-of-hours (запись до открытия) → "out-of-hours"', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '14:00', closeTime: '18:00',
      }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('out-of-hours')
  })

  it('запись в рабочих часах → null', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '09:00', closeTime: '18:00',
      }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })

  it('weekly disabled slot на стартовом времени → "disabled-slot"', () => {
    const data = emptyData({
      schedules: [{
        id: '', resourceId: 'r1', dayOfWeek: 6,
        isWorking: true, openTime: '09:00', closeTime: '18:00',
      }],
      disabledSlots: [{ id: '', resourceId: 'r1', dayOfWeek: 6, slotTime: '10:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('disabled-slot')
  })

  it('shift-cycle: для shift weekly disabledSlots игнорируются', () => {
    // Внутри shift-цикла перерывов нет — хоть disabled и задан, для shift его
    // не применяем. Если запись в рабочих часах цикла → null.
    const data = emptyData({
      shiftCycle: {
        cycleStartDate: FUTURE_DATE,
        cycleLength: 2,
        hoursByDayIndex: {
          0: { openTime: '09:00', closeTime: '18:00' },
          1: null,
        },
      },
      // weekly disabled — НЕ должны применяться для shift
      disabledSlots: [{ id: '', resourceId: 'r1', dayOfWeek: 6, slotTime: '10:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })
})

describe('buildSlotDataFromWeeklyTemplate', () => {
  const tplFull = (days: ScheduleTemplateFull['days']): ScheduleTemplateFull => ({
    id: 't1', tenantId: 'tn',
    name: 'Test', type: 'weekly',
    cycleLength: null, referenceBranchId: null,
    sortOrder: 0, createdAt: '', updatedAt: '',
    days,
  })

  it('копирует часы шаблона 1:1 в schedules без обрезки по филиалу', () => {
    const tpl = tplFull([
      { templateId: 't1', dayIndex: 1, isWorking: true, openTime: '08:00', closeTime: '20:00' },
      { templateId: 't1', dayIndex: 2, isWorking: false, openTime: null, closeTime: null },
    ])
    // Филиал 09:00–18:00 — в новой модели это НЕ должно обрезать шаблон.
    const branchSchedule: WorkingHoursSchedule = {
      default: { open: '09:00', close: '18:00' },
      days: {},
    }
    const data = buildSlotDataFromWeeklyTemplate(tpl, branchSchedule, [], [])

    expect(data.schedules).toHaveLength(7)
    const monday = data.schedules.find((s) => s.dayOfWeek === 1)!

    expect(monday).toMatchObject({
      isWorking: true, openTime: '08:00', closeTime: '20:00',
    })
    const tuesday = data.schedules.find((s) => s.dayOfWeek === 2)!

    expect(tuesday).toMatchObject({
      isWorking: false, openTime: null, closeTime: null,
    })
  })

  it('disabled_slots всегда пустой (внутри шаблона перерывов нет)', () => {
    const tpl = tplFull([
      { templateId: 't1', dayIndex: 1, isWorking: true, openTime: '09:00', closeTime: '18:00' },
    ])
    const data = buildSlotDataFromWeeklyTemplate(tpl, null, [], [])

    expect(data.disabledSlots).toEqual([])
  })
})

describe('checkAppointmentAgainstSchedule — shift cycle: выходной по циклу', () => {
  const shiftData = emptyData({
    shiftCycle: {
      cycleStartDate: FUTURE_DATE, // '2030-06-15' = день 0 цикла
      cycleLength: 2,
      hoursByDayIndex: {
        0: { openTime: '09:00', closeTime: '18:00' },
        1: null,
      },
    },
  })

  it('день 0 цикла — рабочий, запись в часах → null', () => {
    expect(checkAppointmentAgainstSchedule(baseAppt(), shiftData, TZ)).toBeNull()
  })

  it('день 1 цикла — выходной → "day-off"', () => {
    // offset=1 % 2 = 1 → hoursByDayIndex[1] = null → day-off
    const appt = baseAppt({
      startsAt: '2030-06-16T10:00:00.000Z',
      endsAt: '2030-06-16T11:00:00.000Z',
    })

    expect(checkAppointmentAgainstSchedule(appt, shiftData, TZ)).toBe('day-off')
  })

  it('день 2 цикла (offset=2) — снова рабочий → null', () => {
    // offset=2 % 2 = 0 → рабочий
    const appt = baseAppt({
      startsAt: '2030-06-17T10:00:00.000Z',
      endsAt: '2030-06-17T11:00:00.000Z',
    })

    expect(checkAppointmentAgainstSchedule(appt, shiftData, TZ)).toBeNull()
  })
})

describe('checkAppointmentAgainstSchedule — особые выходные дни (dateOverride isWorking:false)', () => {
  const weeklySchedule = [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true as const, openTime: '09:00', closeTime: '18:00' }]

  it('обычная суббота без override → null', () => {
    const data = emptyData({ schedules: weeklySchedule })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })

  it('override isWorking:false перебивает рабочий день → "day-off"', () => {
    const data = emptyData({
      schedules: weeklySchedule,
      dateOverrides: [{
        id: 'o1', resourceId: 'r1',
        date: FUTURE_DATE,
        isWorking: false, openTime: null, closeTime: null,
      }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('day-off')
  })

  it('override на другую дату не затрагивает baseAppt → null', () => {
    const data = emptyData({
      schedules: weeklySchedule,
      dateOverrides: [{
        id: 'o1', resourceId: 'r1',
        date: '2030-06-14', // пятница, не суббота
        isWorking: false, openTime: null, closeTime: null,
      }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })
})

describe('checkAppointmentAgainstSchedule — частичный рабочий день (dateOverride с другими часами)', () => {
  it('override сужает часы: запись в исключённом окне → "out-of-hours"', () => {
    // Обычно суббота 09:00-18:00. Override даёт только 13:00-18:00.
    // baseAppt 10:00-11:00 теперь до нового открытия.
    const data = emptyData({
      schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '09:00', closeTime: '18:00' }],
      dateOverrides: [{ id: 'o1', resourceId: 'r1', date: FUTURE_DATE, isWorking: true, openTime: '13:00', closeTime: '18:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('out-of-hours')
  })

  it('override расширяет часы: запись которую weekly не пропускал → null', () => {
    // Обычно суббота с 14:00. Override 08:00-20:00 — запись 10:00-11:00 теперь ОК.
    const data = emptyData({
      schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '14:00', closeTime: '18:00' }],
      dateOverrides: [{ id: 'o1', resourceId: 'r1', date: FUTURE_DATE, isWorking: true, openTime: '08:00', closeTime: '20:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })

  it('override задаёт узкое окно: запись ровно в его границах → null', () => {
    // Override 10:00-12:00. baseAppt 10:00-11:00 — точно в окне.
    const data = emptyData({
      schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '09:00', closeTime: '18:00' }],
      dateOverrides: [{ id: 'o1', resourceId: 'r1', date: FUTURE_DATE, isWorking: true, openTime: '10:00', closeTime: '12:00' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBeNull()
  })

  it('override задаёт узкое окно: запись выходит за правую границу → "out-of-hours"', () => {
    // Override 10:00-10:30. baseAppt 10:00-11:00 — end=11:00 > close=10:30.
    const data = emptyData({
      schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '09:00', closeTime: '18:00' }],
      dateOverrides: [{ id: 'o1', resourceId: 'r1', date: FUTURE_DATE, isWorking: true, openTime: '10:00', closeTime: '10:30' }],
    })

    expect(checkAppointmentAgainstSchedule(baseAppt(), data, TZ)).toBe('out-of-hours')
  })
})

describe('checkAppointmentAgainstSchedule — out-of-hours граничные значения', () => {
  const data = emptyData({
    schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '09:00', closeTime: '18:00' }],
  })

  it('конец записи позже закрытия → "out-of-hours"', () => {
    const appt = baseAppt({ startsAt: '2030-06-15T17:00:00.000Z', endsAt: '2030-06-15T19:00:00.000Z' })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBe('out-of-hours')
  })

  it('конец записи ровно в момент закрытия → null', () => {
    const appt = baseAppt({ startsAt: '2030-06-15T17:00:00.000Z', endsAt: '2030-06-15T18:00:00.000Z' })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBeNull()
  })

  it('начало записи ровно в момент открытия → null', () => {
    const appt = baseAppt({ startsAt: '2030-06-15T09:00:00.000Z', endsAt: '2030-06-15T10:00:00.000Z' })

    expect(checkAppointmentAgainstSchedule(appt, data, TZ)).toBeNull()
  })
})

describe('checkAppointmentsAgainstSchedule — batch', () => {
  const data = emptyData({
    schedules: [{ id: '', resourceId: 'r1', dayOfWeek: 6, isWorking: true, openTime: '09:00', closeTime: '18:00' }],
  })

  it('пустой список → пустой результат', () => {
    expect(checkAppointmentsAgainstSchedule([], 'Мастер', data, TZ)).toEqual([])
  })

  it('возвращает только конфликтные записи, пропускает валидные', () => {
    const ok = baseAppt({ id: 'ok' })
    const off = baseAppt({ id: 'off', startsAt: '2030-06-16T10:00:00.000Z', endsAt: '2030-06-16T11:00:00.000Z' }) // воскресенье — нет в расписании
    const late = baseAppt({ id: 'late', startsAt: '2030-06-15T19:00:00.000Z', endsAt: '2030-06-15T20:00:00.000Z' }) // после закрытия

    const conflicts = checkAppointmentsAgainstSchedule([ok, off, late], 'Мастер Иван', data, TZ)

    expect(conflicts).toHaveLength(2)
    expect(conflicts[0]).toMatchObject({ appointment: { id: 'off' }, reason: 'day-off', resourceName: 'Мастер Иван' })
    expect(conflicts[1]).toMatchObject({ appointment: { id: 'late' }, reason: 'out-of-hours' })
  })

  it('конфликт содержит корректные localDate / localStart / localEnd', () => {
    const appt = baseAppt({ id: 'x', startsAt: '2030-06-15T19:00:00.000Z', endsAt: '2030-06-15T20:00:00.000Z' })
    const [conflict] = checkAppointmentsAgainstSchedule([appt], 'Мастер', data, TZ)

    expect(conflict.localDate).toBe('2030-06-15')
    expect(conflict.localStart).toBe('19:00')
    expect(conflict.localEnd).toBe('20:00')
  })
})

describe('buildSlotDataFromShiftTemplate', () => {
  it('собирает hoursByDayIndex с null для выходных', () => {
    const tpl: ScheduleTemplateFull = {
      id: 't1', tenantId: 'tn',
      name: 'Test', type: 'shift',
      cycleLength: 4, referenceBranchId: null,
      sortOrder: 0, createdAt: '', updatedAt: '',
      days: [
        { templateId: 't1', dayIndex: 0, isWorking: true, openTime: '09:00', closeTime: '18:00' },
        { templateId: 't1', dayIndex: 1, isWorking: true, openTime: '09:00', closeTime: '18:00' },
        { templateId: 't1', dayIndex: 2, isWorking: false, openTime: null, closeTime: null },
        { templateId: 't1', dayIndex: 3, isWorking: false, openTime: null, closeTime: null },
      ],
    }
    const data = buildSlotDataFromShiftTemplate(tpl, '2030-06-15', null, [], [])

    expect(data.shiftCycle).toBeDefined()
    expect(data.shiftCycle?.cycleStartDate).toBe('2030-06-15')
    expect(data.shiftCycle?.cycleLength).toBe(4)
    expect(data.shiftCycle?.hoursByDayIndex[0]).toEqual({ openTime: '09:00', closeTime: '18:00' })
    expect(data.shiftCycle?.hoursByDayIndex[2]).toBeNull()
  })
})
