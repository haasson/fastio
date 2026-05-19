const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

/**
 * Форматирует цену с символом ₽ и thousand-separator'ами:
 * `1500` → `"1 500 ₽"`, `0` → `"0 ₽"`, `"200"` → `"200 ₽"`.
 *
 * Принимает любой `unknown` — number/numeric-string форматируется, всё
 * остальное (null, undefined, NaN, boolean, object, нечисловая строка)
 * возвращает прочерк. Если по логике компонента пустое значение это
 * «бесплатно» или «скрыто», заворачивай в условие в шаблоне, а не
 * подсовывай 0.
 */
export const formatPrice = (value: unknown): string => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? priceFormatter.format(value) : '—'
  }
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isFinite(num) ? priceFormatter.format(num) : '—'
  }
  return '—'
}

/**
 * Склонение существительного по числу (русский язык).
 * pluralize(1, 'день', 'дня', 'дней') → 'день'
 * pluralize(3, 'день', 'дня', 'дней') → 'дня'
 * pluralize(5, 'день', 'дня', 'дней') → 'дней'
 */
export const pluralize = (n: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100

  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few

  return many
}
