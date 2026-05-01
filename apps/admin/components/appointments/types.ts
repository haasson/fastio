export type EditorService = {
  _key: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  price: number
  // Hint предпочтительного мастера. Применяется при поиске слотов для этой
  // услуги и подсвечивается зелёным/жёлтым в чипсах.
  preferredResourceId: string | null
  // ID существующей записи (если услуга уже сохранена). null для новых.
  appointmentId: string | null
  // Помечена на удаление: при сохранении вызовется appointments.cancel().
  pendingRemove: boolean
  // Текущий слот: для существующих — взят из appointment при префилле,
  // для новых — null пока юзер не выберет чипсу. Все три значения локальные
  // в TZ тенанта, привязаны к visit.businessDate.
  currentResourceId: string | null
  currentStartTime: string | null // "HH:MM"
  currentEndTime: string | null // "HH:MM"
  // Снапшот изначальных значений (на момент префилла из БД). Используется
  // в UI для отрисовки «старое зачёркнутое → новое» при правке слота/мастера
  // и для вычисления isSlotChanged. Для новых услуг (без appointmentId) — все null.
  originalResourceId: string | null
  originalStartTime: string | null
  originalEndTime: string | null
}

/**
 * «Слот изменился относительно prefill» — сигнал звать
 * `appointments.reschedule` при сохранении. Считается из current* vs original*,
 * хранить отдельный флаг smysla не имеет: после applySlotToSelected/setPreferredResource
 * раньше его выставляли вручную, теперь — derived.
 */
export const isSlotChanged = (svc: EditorService): boolean => {
  if (!svc.appointmentId) return false // новая услуга, не reschedule

  return svc.currentStartTime !== svc.originalStartTime
    || svc.currentEndTime !== svc.originalEndTime
    || svc.currentResourceId !== svc.originalResourceId
}

export type EditorState = {
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  branchId: string | null
  // Бизнес-день визита: НЕ редактируется на странице визита (для переноса —
  // отдельная модалка). В create-mode задаётся пользователем через preset
  // или select даты в модалке создания (TODO).
  date: string | null
  services: EditorService[]
}

export type EditorSnapshot = {
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  branchId: string | null
  date: string | null
  servicesKey: string
}
