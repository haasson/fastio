import { computed, type Ref } from 'vue'
import type { Appointment, Visit, VisitAggregateStatus } from '@fastio/shared'

/**
 * Считает агрегатные флаги визита из визита + списка appointments.
 * Используется на странице визита для расчёта state кнопок «Подтвердить/
 * Завершить/Отменить» и тэга-статуса. Та же логика что и в `useVisitsList`
 * (через `aggregateFromVisit`), но там — батчевая по statusCounts, а здесь —
 * над живым массивом appointments конкретного визита.
 */
export function useVisitAggregate(
  visit: Ref<Visit | null>,
  appointments: Ref<Appointment[]>,
) {
  const isRequestVisit = computed(() => visit.value?.status === 'request')

  // «Активные» = не отменённые и не завершённые. Кандидаты на «Подтвердить»
  // (есть new) и «Завершить» (все confirmed, ничего нового).
  const activeAppointments = computed(() => appointments.value.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'done',
  ))
  const hasPending = computed(() => activeAppointments.value.some((a) => a.status === 'new'))
  const hasActive = computed(() => activeAppointments.value.length > 0)

  // Подтвердить — pending pickup'аем. Кнопка отдельная от save:
  // менеджер мог не добавлять услугу, но хочет подтвердить request-визит сразу.
  const canConfirm = computed(() => hasPending.value)

  // Отменить можно всё кроме уже отменённого. Для request-визита
  // (нет appointments) тоже даём — он просто переходит в cancelled
  // (бывшая операция «Отклонить заявку»).
  const canCancel = computed(() => !!visit.value
    && visit.value.status !== 'cancelled'
    && (hasActive.value || isRequestVisit.value))

  const canDone = computed(() => hasActive.value && !hasPending.value)

  const aggregateStatus = computed<VisitAggregateStatus>(() => {
    const v = visit.value

    if (!v) return 'pending'
    if (v.status === 'request') return 'request'
    if (v.status === 'cancelled') return 'cancelled'

    let newC = 0
    let confC = 0
    let doneC = 0
    let cancC = 0

    for (const a of appointments.value) {
      if (a.status === 'new') newC++
      else if (a.status === 'confirmed') confC++
      else if (a.status === 'done') doneC++
      else if (a.status === 'cancelled') cancC++
    }
    const total = newC + confC + doneC + cancC

    if (total === 0) return 'pending'
    if (newC > 0) return 'pending'
    if (cancC === total) return 'cancelled'
    if (doneC > 0 && newC === 0 && confC === 0 && doneC + cancC === total) return 'done'
    if (confC + doneC === total) return 'confirmed'

    return 'mixed'
  })

  return {
    activeAppointments,
    isRequestVisit,
    hasPending,
    hasActive,
    aggregateStatus,
    canConfirm,
    canCancel,
    canDone,
  }
}
