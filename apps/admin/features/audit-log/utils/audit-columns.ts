// Колонки таблицы журнала аудита (/audit-log): дата / действие / объект / изменения / сотрудник.
// Ячейки рендерятся SFC-примитивами (AuditEntityRef, AuditChange, AuditAction, AuditActor) —
// scoped CSS страницы не доходит до h()-нод, поэтому стили живут в самих компонентах,
// а фабрика только собирает дерево. «Действие» — приглушённая колонка: цветная точка
// для created/deleted/restored, тихий hint-текст без точки для updated.

import { h } from 'vue'
import type { VNode } from 'vue'
import { formatDateTime } from '@fastio/shared'
import { UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import { renderChanges } from './audit-labels'
import type { JournalRow } from './journal-row'
import AuditChange from '../components/AuditChange.vue'
import AuditAction from '../components/AuditAction.vue'
import AuditEntityRef from '../components/AuditEntityRef.vue'
import AuditActor from '../components/AuditActor.vue'

const hintStyle = 'color: var(--color-text-hint)'

// Вертикальный стек строк колонки «Изменения». Инлайн-стиль вместо класса:
// scoped-селекторы страницы до этой ноды не достают. max-width ограничивает
// длину строки — контент внутри переносится, не обрезается.
// gap-8, не gap-4: дельты двухэтажные (лейбл + значения), при меньшем зазоре
// граница между соседними дельтами визуально терялась бы.
const changesStack = (children: VNode[]): VNode => h('div', { style: 'display: flex; flex-direction: column; gap: var(--space-8); max-width: 360px' }, children)

export type AuditColumnsOptions = {
  // Лепить в колонку «Объект» компактный чип с именем филиала записи (только для
  // филиальных строк; общевендорные — без чипа). Нужен, когда в скоупе несколько
  // филиалов («все филиалы» у мультифилиального тенанта).
  showBranchLabel?: boolean
}

export const auditLogColumns = (opts: AuditColumnsOptions = {}): DataTableColumns<JournalRow> => [
  {
    title: 'Дата',
    key: 'createdAt',
    width: 150,
    render: (row) => h(UiText, { size: 'tiny', style: `${hintStyle}; white-space: nowrap` }, () => formatDateTime(row.createdAt)),
  },
  {
    title: 'Действие',
    key: 'action',
    width: 110,
    // updated — самый частый и самый «тихий» тип: без точки, серым текстом;
    // created/deleted/restored — цветная точка + цветной лейбл.
    render: (row) => h(AuditAction, { action: row.action, dot: row.action !== 'updated' }),
  },
  {
    title: 'Объект',
    key: 'entityName',
    width: 240,
    render: (row) => {
      // Чип филиала под названием — только для филиальных строк журнала
      // (общевендорные branchBadge.shared не показываем).
      const badge = opts.showBranchLabel ? row.branchBadge : undefined
      const branchLabel = badge && !badge.shared ? badge.label : null

      return h(AuditEntityRef, { entityType: row.entityType, entityName: row.entityName, branchLabel })
    },
  },
  {
    title: 'Изменения',
    key: 'changes',
    render: (row) => {
      // Order-строки несут готовую русскую сводку (status_changed → «Новый → Готов»):
      // рендерим её фразой через AuditChange — единый вид с дельтами конфиг-строк.
      if (row.changeSummary) {
        return changesStack([
          h(AuditChange, { change: { field: '_summary', label: row.changeSummary, oldValue: '', newValue: '', kind: 'phrase', direction: null } }),
        ])
      }

      const changes = renderChanges(row)

      // Без читаемого диффа — прочерк: само слово действия живёт в колонке «Действие».
      if (changes.length === 0) return h(UiText, { size: 'tiny', style: hintStyle }, () => '—')

      const LIMIT = 6
      const rows = changes.slice(0, LIMIT).map((change) => h(AuditChange, { change }))

      if (changes.length > LIMIT) {
        rows.push(h(UiText, { size: 'tiny', style: hintStyle }, () => `… ещё ${changes.length - LIMIT}`))
      }

      return changesStack(rows)
    },
  },
  {
    title: 'Сотрудник',
    key: 'actorName',
    width: 170,
    render: (row) => h(AuditActor, { name: row.actorName, role: row.actorRole, email: row.actorEmail ?? null }),
  },
]
