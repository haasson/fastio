/**
 * Локальный трекер броней «в рамках текущего bulk» для round-robin auto-pick.
 *
 * Храним именно интервалы (а не голый счётчик), чтобы исключать мастера из
 * кандидатов только если у него реально конфликт по времени с текущим item-ом.
 * До этого фикса логика была «если у мастера ЕСТЬ хоть какой local-booking —
 * исключать»: при цепочке 18:30-19:30 + 19:30-20:30 единственный мастер,
 * умеющий обе услуги, отсеивался на втором item-е → 409, хотя по таймингу
 * конфликта нет.
 */
export type LocalBookings = ReturnType<typeof createLocalBookings>

export function createLocalBookings() {
  const bookings = new Map<string, Array<{ startsAt: string; endsAt: string }>>()

  return {
    /** Сколько локальных броней (для round-robin tiebreak по нагрузке). */
    count(rid: string): number {
      return bookings.get(rid)?.length ?? 0
    },

    /** Зарезервировать интервал за ресурсом в локальном трекере. */
    reserve(rid: string, startsAt: string, endsAt: string) {
      const arr = bookings.get(rid) ?? []
      arr.push({ startsAt, endsAt })
      bookings.set(rid, arr)
    },

    /** Есть ли у ресурса локальная бронь, пересекающаяся с (startsAt, endsAt). */
    hasOverlap(rid: string, startsAt: string, endsAt: string): boolean {
      const arr = bookings.get(rid)
      if (!arr) return false
      return arr.some((iv) => iv.startsAt < endsAt && iv.endsAt > startsAt)
    },
  }
}
