export const formatRelativeDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)

  yesterday.setDate(now.getDate() - 1)

  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const isThisYear = d.getFullYear() === now.getFullYear()

  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return time
  if (isYesterday) return `Вчера, ${time}`

  const datePart = d.toLocaleDateString('ru-RU', isThisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' },
  )

  return `${datePart}, ${time}`
}
