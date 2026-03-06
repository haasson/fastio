export const formatRelativeTime = (isoDate: string, now: Date): string => {
  const diff = now.getTime() - new Date(isoDate).getTime()
  const min = Math.floor(diff / 60_000)

  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`

  const h = Math.floor(min / 60)

  if (h < 24) return `${h} ч назад`

  return new Date(isoDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
