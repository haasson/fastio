import { describe, it, expect } from 'vitest'
import { getAvailableSlots } from '../utils/scheduling'
import type { WorkingHoursSchedule } from '../types/tenant'

const OPTS = { step: 30, leadMinutes: 0, closeBufferMinutes: 0, nowMinutes: null }

// 2026-04-06 = Пн (ISO 1)

describe('getAvailableSlots с исключениями', () => {
  const base: WorkingHoursSchedule = {
    default: { open: '10:00', close: '12:00' }, // 10:00–12:00 → 4 слота
    days: {},
  }

  it('возвращает пустой массив если дата помечена dayOff в exceptions', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '10:00', close: '12:00', dayOff: true } },
    }
    expect(getAvailableSlots('2026-04-06', schedule, OPTS)).toEqual([])
  })

  it('возвращает слоты в рамках кастомных часов из исключения', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '11:00', close: '12:00' } },
    }
    const slots = getAvailableSlots('2026-04-06', schedule, OPTS)
    // closeBufferMinutes=0 включает закрывающий слот, поэтому 11:00, 11:30, 12:00
    expect(slots.map(s => s.value)).toEqual(['11:00', '11:30', '12:00'])
  })

  it('слоты из recurring-исключения (кастомные часы)', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--04-06': { open: '11:00', close: '12:00' } },
    }
    const slots = getAvailableSlots('2026-04-06', schedule, OPTS)
    expect(slots.map(s => s.value)).toEqual(['11:00', '11:30', '12:00'])
  })

  it('recurring dayOff → пустой массив', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--04-06': { open: '10:00', close: '12:00', dayOff: true } },
    }
    expect(getAvailableSlots('2026-04-06', schedule, OPTS)).toEqual([])
  })

  it('конкретная дата перебивает recurring — разные часы', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--04-06': { open: '10:00', close: '12:00', dayOff: true } },
      exceptions: { '2026-04-06': { open: '11:00', close: '12:00' } }, // не выходной
    }
    const slots = getAvailableSlots('2026-04-06', schedule, OPTS)
    expect(slots.map(s => s.value)).toEqual(['11:00', '11:30', '12:00'])
  })

  it('исключение не затрагивает другие даты', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '10:00', close: '12:00', dayOff: true } },
    }
    // 2026-04-07 = Вт — не под исключением, дефолт 10:00–12:00
    const slots = getAvailableSlots('2026-04-07', schedule, OPTS)
    expect(slots.map(s => s.value)).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00'])
  })

  it('allDay-исключение возвращает слоты на весь день (1440 / step)', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '00:00', close: '00:00', allDay: true } },
    }
    const slots = getAvailableSlots('2026-04-06', schedule, OPTS)
    expect(slots.length).toBe(1440 / 30) // 48
    expect(slots[0].value).toBe('00:00')
    expect(slots[47].value).toBe('23:30')
  })
})
