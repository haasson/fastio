/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Тесты GET /api/tel/[phone] — редирект на tel: URI.
 *
 * Покрывает строгую валидацию формата (PREPROD-108): отказ от любых injection-символов,
 * проверка длины digits, корректный 302 на валидном номере.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReportError = vi.fn()

vi.mock('@fastio/shared/observability', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

let currentPhone = ''
let currentReferer: string | undefined = undefined
let lastRedirect: { url: string; status: number } | null = null

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')

  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    getRouterParam: vi.fn(() => currentPhone),
    getRequestHeader: vi.fn(() => currentReferer),
    sendRedirect: vi.fn(async (_event: unknown, url: string, status: number) => {
      lastRedirect = { url, status }

      return undefined
    }),
  }
})

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ adminUrl: 'https://admin.fastio.ru' }),
}))

import handler from '../[phone].get'

function makeEvent() {
  return {} as any
}

beforeEach(() => {
  vi.clearAllMocks()
  currentPhone = ''
  currentReferer = undefined // отсутствие Referer = OK (Telegram native client)
  lastRedirect = null
})

describe('GET /api/tel/[phone]', () => {
  it('редиректит валидный номер с + на tel:+<digits> со статусом 302', async () => {
    currentPhone = '+79991234567'

    await handler(makeEvent())

    expect(lastRedirect).toEqual({ url: 'tel:+79991234567', status: 302 })
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('редиректит валидный номер без + (только цифры)', async () => {
    currentPhone = '79991234567'

    await handler(makeEvent())

    expect(lastRedirect).toEqual({ url: 'tel:+79991234567', status: 302 })
  })

  it('400 на буквенный ввод (abc)', () => {
    currentPhone = 'abc'

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(lastRedirect).toBeNull()
  })

  it('400 на пробелы/тире/скобки (потенциальная injection-поверхность)', () => {
    currentPhone = '+7 (999) 123-45-67'

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('400 на попытку injection через перенос строки/CR-LF', () => {
    currentPhone = '79991234567\r\nLocation: https://evil.com'

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('400 на слишком короткий номер (< 10 цифр)', () => {
    currentPhone = '123456789'

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('400 на слишком длинный номер (> 15 цифр)', () => {
    currentPhone = '1234567890123456'

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('400 на пустую строку', () => {
    currentPhone = ''

    expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('принимает граничное значение: 10 цифр', async () => {
    currentPhone = '1234567890'

    await handler(makeEvent())

    expect(lastRedirect).toEqual({ url: 'tel:+1234567890', status: 302 })
  })

  it('принимает граничное значение: 15 цифр (E.164 max)', async () => {
    currentPhone = '123456789012345'

    await handler(makeEvent())

    expect(lastRedirect).toEqual({ url: 'tel:+123456789012345', status: 302 })
  })

  describe('referer whitelist (PREPROD-200)', () => {
    it('пропускает запрос без Referer (Telegram native client)', async () => {
      currentPhone = '+79991234567'
      currentReferer = undefined

      await handler(makeEvent())

      expect(lastRedirect).toEqual({ url: 'tel:+79991234567', status: 302 })
    })

    it('пропускает Referer от admin.fastio.ru', async () => {
      currentPhone = '+79991234567'
      currentReferer = 'https://admin.fastio.ru/orders/123'

      await handler(makeEvent())

      expect(lastRedirect).toEqual({ url: 'tel:+79991234567', status: 302 })
    })

    it('пропускает Referer от t.me (Telegram web/mobile)', async () => {
      currentPhone = '+79991234567'
      currentReferer = 'https://t.me/some_bot'

      await handler(makeEvent())

      expect(lastRedirect).toEqual({ url: 'tel:+79991234567', status: 302 })
    })

    it('403 при Referer от чужого origin (open-redirect защита)', () => {
      currentPhone = '+79991234567'
      currentReferer = 'https://evil.com/phishing'

      expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 403 }))
      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(lastRedirect).toBeNull()
    })

    it('403 при попытке подмены через prefix-collision (admin.fastio.ru.evil.com)', () => {
      currentPhone = '+79991234567'
      currentReferer = 'https://admin.fastio.ru.evil.com/redirect'

      expect(() => handler(makeEvent())).toThrow(expect.objectContaining({ statusCode: 403 }))
    })
  })
})
