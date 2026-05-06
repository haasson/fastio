import { computed, ref, type Ref } from 'vue'
import type { Appointment } from '@fastio/shared'

const DRAG_THRESHOLD = 4

type DragState = {
  appt: Appointment
  pointerId: number
  startY: number
  startX: number
  dy: number
  sourceResourceId: string
  targetResourceId: string
  activated: boolean
} | null

export type DragGhost = {
  targetResourceId: string
  style: Record<string, string>
  invalid: boolean
  reason: string | null
}

type Params = {
  editable: Ref<boolean>
  pxPerMin: Ref<number>
  slotStep: Ref<number>
  windowStartMin: Ref<number>
  isoToWindowMinutes: (iso: string) => number
  getMoveBlocker?: (payload: { appt: Appointment; dyMin: number; newResourceId: string }) => string | null
  onClick: (appt: Appointment) => void
  onMove: (payload: { appt: Appointment; dyMin: number; newResourceId: string }) => void
}

/**
 * Pointer-handlers и ghost-блок для drag&drop карточки записи в таймлайне.
 *
 * Capture pointer'а берётся не сразу, а только после прохождения порога
 * DRAG_THRESHOLD — иначе на сенсорах вертикальный скролл блокируется в момент
 * касания карточки. Hit-test (определение целевой колонки) дросселируется
 * через rAF, чтобы не делать sync-layout на каждом move-эвенте.
 *
 * При pointerup без активации drag'а вызывается onClick (тап). При активации
 * — onMove с (dy в минутах, новый resource_id).
 */
export function useTimelineDrag(params: Params) {
  const {
    editable, pxPerMin, slotStep, windowStartMin,
    isoToWindowMinutes, getMoveBlocker, onClick, onMove,
  } = params

  const dragState = ref<DragState>(null)

  const snapDyMin = (dy: number): number => Math.round(dy / pxPerMin.value / slotStep.value) * slotStep.value

  const dragGhost = computed<DragGhost | null>(() => {
    const s = dragState.value

    if (!s || !s.activated) return null

    const startMin = isoToWindowMinutes(s.appt.startsAt)
    const endIso = s.appt.actualEndsAt ?? s.appt.endsAt
    let endMin = isoToWindowMinutes(endIso)

    if (endMin <= startMin) endMin += 1440

    const dyMin = snapDyMin(s.dy)
    const newStart = startMin + dyMin
    const top = (newStart - windowStartMin.value) * pxPerMin.value
    const height = (endMin - startMin) * pxPerMin.value

    const sourceUnchanged = dyMin === 0 && s.targetResourceId === s.sourceResourceId
    const reason = !sourceUnchanged && getMoveBlocker
      ? getMoveBlocker({ appt: s.appt, dyMin, newResourceId: s.targetResourceId })
      : null

    return {
      targetResourceId: s.targetResourceId,
      style: { top: `${top}px`, height: `${height}px` },
      invalid: reason !== null,
      reason,
    }
  })

  const onCardPointerDown = (ev: PointerEvent, appt: Appointment, resourceId: string) => {
    // Capture НЕ ставим сразу: иначе на сенсорах вертикальный скролл таймлайна
    // блокируется, как только палец опустился на карточку. Захват берём только
    // после прохождения DRAG_THRESHOLD в onCardPointerMove. До этого pointerup
    // нормально сработает как клик, потому что target — та же карточка.
    dragState.value = {
      appt,
      pointerId: ev.pointerId,
      startY: ev.clientY,
      startX: ev.clientX,
      dy: 0,
      sourceResourceId: resourceId,
      targetResourceId: resourceId,
      activated: false,
    }
  }

  // Hit-test через elementFromPoint дёрганый: на сенсорах десятки move-событий
  // в секунду, на каждом — синхронный layout. Откладываем до ближайшего rAF
  // и берём последние координаты.
  let pendingHitTest: { x: number; y: number } | null = null
  let hitTestRafId: number | null = null

  const scheduleHitTest = (x: number, y: number) => {
    pendingHitTest = { x, y }
    if (hitTestRafId !== null) return
    hitTestRafId = requestAnimationFrame(() => {
      hitTestRafId = null
      const s = dragState.value
      const p = pendingHitTest

      pendingHitTest = null
      if (!s || !p) return
      const el = (document.elementFromPoint(p.x, p.y) as HTMLElement | null)?.closest('.resource-col') as HTMLElement | null
      const rid = el?.dataset.resourceId

      if (rid) s.targetResourceId = rid
    })
  }

  const onCardPointerMove = (ev: PointerEvent) => {
    const s = dragState.value

    if (!s || ev.pointerId !== s.pointerId) return

    // Drag активируется только если редактирование разрешено и запись не отменена.
    // Иначе любое смещение игнорируется, и pointerup эмитит обычный клик.
    if (!editable.value || s.appt.status === 'cancelled') return

    const dy = ev.clientY - s.startY
    const dx = ev.clientX - s.startX

    if (!s.activated && Math.abs(dy) + Math.abs(dx) > DRAG_THRESHOLD) {
      s.activated = true
      // Захватываем pointer ровно в момент активации drag — теперь следующие move
      // и up придут на эту карточку, даже если палец ушёл на другой ресурс.
      ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    }
    s.dy = dy

    if (s.activated) scheduleHitTest(ev.clientX, ev.clientY)
  }

  const onCardPointerUp = (ev: PointerEvent) => {
    const s = dragState.value

    if (!s || ev.pointerId !== s.pointerId) return

    const target = ev.currentTarget as HTMLElement

    if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId)

    if (!s.activated) {
      dragState.value = null
      onClick(s.appt)

      return
    }

    const dyMin = snapDyMin(s.dy)
    const moved = dyMin !== 0 || s.targetResourceId !== s.sourceResourceId

    dragState.value = null

    if (moved) onMove({ appt: s.appt, dyMin, newResourceId: s.targetResourceId })
  }

  const onCardPointerCancel = (_ev: PointerEvent) => {
    dragState.value = null
  }

  return {
    dragState,
    dragGhost,
    onCardPointerDown,
    onCardPointerMove,
    onCardPointerUp,
    onCardPointerCancel,
  }
}
