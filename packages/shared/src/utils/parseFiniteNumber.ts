/**
 * Безопасный парсер числа из user-controlled input'а (query/body).
 *
 * Защищает от:
 * - `Infinity` / `-Infinity` / `NaN` (через `Number.isFinite`)
 * - Number overflow при умножении (Number(body.subtotal) * priceFactor → +Infinity при экстремальных значениях)
 * - Магических `Number(undefined) → NaN` → ловится на этапе валидации
 *
 * Default `max = Number.MAX_SAFE_INTEGER / 100` — даёт x100 запаса перед потерей точности
 * (для копеек / процентов / умножений на rate). Default `min = 0` — большинство публичных
 * полей (subtotal, lat, lon — нет, для них передавать override).
 *
 * Возвращает `null` если input невалиден — caller сам решит как реагировать (400 / fallback / etc).
 *
 * Пример:
 * ```ts
 * const subtotal = parseFiniteNumber(body.subtotal)
 * if (subtotal === null) throw createError({ statusCode: 400, message: 'Некорректная сумма' })
 * ```
 */

export type ParseFiniteNumberOptions = {
  /** Минимально допустимое значение включительно. Default: 0. */
  min?: number
  /** Максимально допустимое значение включительно. Default: Number.MAX_SAFE_INTEGER / 100. */
  max?: number
}

const DEFAULT_MAX = Number.MAX_SAFE_INTEGER / 100

export function parseFiniteNumber(
  input: unknown,
  options: ParseFiniteNumberOptions = {},
): number | null {
  const { min = 0, max = DEFAULT_MAX } = options

  // Number(undefined) → NaN, Number(null) → 0, Number('') → 0. null/undefined считаем «нет значения».
  if (input === null || input === undefined) return null

  // Number(true) → 1, Number(false) → 0 — нежелательно пропускать булеаны как числа.
  if (typeof input === 'boolean') return null

  // Number([]) → 0, Number(['1']) → 1, Number({}) → NaN — отсекаем нескалярные сразу.
  if (typeof input === 'object') return null

  const num = Number(input)

  if (!Number.isFinite(num)) return null
  if (num < min) return null
  if (num > max) return null

  return num
}
