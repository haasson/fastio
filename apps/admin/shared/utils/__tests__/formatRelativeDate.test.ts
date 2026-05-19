import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeDate } from '../formatRelativeDate'

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Фиксируем "сейчас" через fake timers, чтобы тесты не зависели от
 * реального времени выполнения.
 */

describe('formatRelativeDate', () => {
  describe('сегодня', () => {
    it('дата сегодня → возвращает только время HH:MM', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T15:00:00'))

      const result = formatRelativeDate('2026-03-15T10:30:00')

      expect(result).toBe('10:30')
    })

    it('дата сегодня в другое время — тоже только время', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T23:59:00'))

      const result = formatRelativeDate('2026-03-15T00:05:00')

      expect(result).toBe('00:05')
    })
  })

  describe('вчера', () => {
    it('вчерашняя дата → "Вчера, HH:MM"', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T12:00:00'))

      const result = formatRelativeDate('2026-03-14T09:15:00')

      expect(result).toMatch(/^Вчера,/)
      expect(result).toContain('09:15')
    })
  })

  describe('этот год', () => {
    it('дата в этом году → дата без года + время', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-20T12:00:00'))

      const result = formatRelativeDate('2026-03-01T08:00:00')

      // Должен содержать время
      expect(result).toContain('08:00')
      // Не должен содержать год
      expect(result).not.toContain('2026')
    })
  })

  describe('прошлые годы', () => {
    it('дата прошлого года → содержит год', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T12:00:00'))

      const result = formatRelativeDate('2025-01-10T14:30:00')

      expect(result).toContain('2025')
      expect(result).toContain('14:30')
    })

    it('дата двухлетней давности → содержит год', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T12:00:00'))

      const result = formatRelativeDate('2024-07-04T20:00:00')

      expect(result).toContain('2024')
    })
  })
})
