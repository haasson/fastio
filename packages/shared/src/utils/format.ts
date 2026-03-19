const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export const formatPrice = (price: number) => priceFormatter.format(price)

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
