import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dateStrToTs, formatDateStr, isoToTs, tsToIso, tsToIsoEndOfDay, todayStr } from '../utils/date'

describe('dateStrToTs', () => {
  it('конвертирует YYYY-MM-DD в timestamp полудня', () => {
    const ts = dateStrToTs('2026-03-15')
    const d = new Date(ts)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // март = 2
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(12)
  })

  it('два разных дня дают разные timestamp', () => {
    expect(dateStrToTs('2026-03-15')).not.toBe(dateStrToTs('2026-03-16'))
  })
})

describe('formatDateStr', () => {
  it('timestamp → YYYY-MM-DD', () => {
    const ts = new Date('2026-03-15T12:00:00').getTime()
    expect(formatDateStr(ts)).toBe('2026-03-15')
  })

  it('месяц и день дополняются нулём', () => {
    const ts = new Date('2026-01-05T12:00:00').getTime()
    expect(formatDateStr(ts)).toBe('2026-01-05')
  })

  it('dateStrToTs и formatDateStr — обратные операции', () => {
    const original = '2026-06-20'
    expect(formatDateStr(dateStrToTs(original))).toBe(original)
  })
})

describe('isoToTs', () => {
  it('ISO строка → timestamp', () => {
    const ts = isoToTs('2026-03-15T10:00:00Z')
    expect(typeof ts).toBe('number')
    expect(ts).toBe(new Date('2026-03-15T10:00:00Z').getTime())
  })

  it('null → null', () => {
    expect(isoToTs(null)).toBeNull()
  })
})

describe('tsToIso', () => {
  it('timestamp → ISO строка', () => {
    const ts = new Date('2026-03-15T10:00:00Z').getTime()
    expect(tsToIso(ts)).toBe('2026-03-15T10:00:00.000Z')
  })

  it('null → null', () => {
    expect(tsToIso(null)).toBeNull()
  })
})

describe('tsToIsoEndOfDay', () => {
  it('выставляет время 23:59:59.999 local time', () => {
    const ts = new Date('2026-04-16T00:00:00').getTime() // полночь local
    const result = tsToIsoEndOfDay(ts)
    const d = new Date(result!)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(3) // апрель = 3
    expect(d.getDate()).toBe(16)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
    expect(d.getSeconds()).toBe(59)
  })

  it('null → null', () => {
    expect(tsToIsoEndOfDay(null)).toBeNull()
  })
})

describe('todayStr', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('возвращает текущую дату в формате YYYY-MM-DD', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00'))
    expect(todayStr()).toBe('2026-03-15')
  })
})
