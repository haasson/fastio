// Адаптер JournalEvent → строка таблицы для общего журнала.
// JournalRow расширяет AuditLog: рендер диффов (`renderChanges`) и колонки
// (`auditLogColumns`, типизированы по JournalRow) работают с одной формой.
// Плюс резолв бейджа области (филиал: null → «Всё заведение», иначе имя из стора).

import type { AuditLog, JournalEvent } from '@fastio/shared'
import { formatEventText } from '~/features/orders'

export type BranchBadge = {
  label: string
  // shared = общая запись (branchId === null), показываем нейтрально
  shared: boolean
}

// Строка таблицы: форма AuditLog (для auditLogColumns) + предрассчитанный бейдж области.
// changeSummary — человекочитаемая сводка события заказа (status_changed → «Новый → Готов»)
// для колонки «Изменения». Заполняется ТОЛЬКО для order-строк; для конфиг-строк undefined
// (колонка «Изменения» рендерит их через renderChanges как раньше).
export type JournalRow = AuditLog & {
  branchBadge: BranchBadge
  changeSummary?: string
  // email актора (live-join auth.users в journal_events): вторая строка колонки «Сотрудник» —
  // по одному имени людей легко перепутать. NULL для системных записей и удалённых юзеров.
  actorEmail?: string | null
}

// Имя филиала из словаря id→name. null → «Всё заведение», неизвестный → «Филиал».
export const branchBadge = (branchId: string | null, branchNames: Map<string, string>): BranchBadge => {
  if (!branchId) return { label: 'Всё заведение', shared: true }

  return { label: branchNames.get(branchId) ?? 'Филиал', shared: false }
}

// JournalEvent + словарь филиалов → строка для таблицы.
export const toJournalRow = (ev: JournalEvent, branchNames: Map<string, string>, tenantId: string): JournalRow => ({
  id: ev.id,
  tenantId,
  actorId: ev.actorId,
  actorName: ev.actorName,
  // У журнала нет роли актора — колонка переживёт null (показывает только имя).
  actorRole: null,
  actorEmail: ev.actorEmail,
  // eventType: для audit это action ('updated'), для order — нормализованный SQL'ом
  // action ('created'/'updated'). Колонка «Действие» рендерит его маркером (AuditAction).
  action: ev.eventType,
  entityType: ev.entityType,
  entityId: ev.entityId,
  entityName: ev.entityName,
  payload: ev.payload,
  changedFields: ev.changedFields,
  parentType: null,
  parentId: null,
  createdAt: ev.occurredAt,
  branchBadge: branchBadge(ev.branchId, branchNames),
  // Для заказов колонка «Изменения» показывает русскую сводку из словаря order-событий
  // (formatEventText). Сырой тип события сташен SQL'ом в payload._order_event (т.к. action
  // нормализован до created/updated); фоллбэк на eventType, если ключа нет.
  changeSummary: ev.source === 'order'
    ? (formatEventText(String(ev.payload['_order_event'] ?? ev.eventType), ev.payload) || undefined)
    : undefined,
})
