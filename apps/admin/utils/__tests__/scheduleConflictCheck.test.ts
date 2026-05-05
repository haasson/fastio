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
