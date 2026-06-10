// Колонки таблицы журнала аудита (/audit-log). Вынесены из страницы: рендер строк
// (дата/действие/объект/изменения/сотрудник) — чистая фабрика без состояния страницы.

import { h } from 'vue'
import type { VNode } from 'vue'
import { formatDateTime } from '@fastio/shared'
import { UiTag, UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import { entityTypeLabel, actionMeta, renderChanges } from './audit-labels'
import type { RenderedChange } from './audit-labels'
import type { JournalRow } from './journal-row'

const hintStyle = 'color: var(--color-text-hint)'

const renderChangeRow = (c: RenderedChange): VNode => {
  if (c.kind === 'phrase') {
    return h(UiText, { size: 'tiny', class: 'change-line' }, () => c.label)
  }

  if (c.kind === 'complex') {
    return h(UiText, { size: 'tiny', class: 'change-line' }, () => `${c.label}: изменено`)
  }

  if (c.kind === 'price') {
    const newColor = c.direction === 'up'
      ? 'var(--red-500)'
      : c.direction === 'down'
        ? 'var(--green-500)'
        : 'var(--color-text)'

    return h(UiText, { size: 'tiny', class: 'change-line' }, () => [
      `${c.label}: `,
      h('span', { class: 'old-value' }, c.oldValue),
      ' → ',
      h('span', { style: `color: ${newColor}; font-weight: var(--font-weight-medium)` }, c.newValue),
    ])
  }

  return h(UiText, { size: 'tiny', class: 'change-line' }, () => `${c.label}: ${c.oldValue} → ${c.newValue}`)
}

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
    width: 130,
    render: (row) => {
      // Всегда тег действия. Order-строки приходят с нормализованным action
      // (created/updated из SQL) → тоже корректный Создано/Изменено тег.
      const meta = actionMeta(row.action)

      return h(UiTag, { type: meta.tone, size: 'small', round: true, empty: true }, () => meta.label)
    },
  },
  {
    title: 'Объект',
    key: 'entityName',
    width: 220,
    render: (row) => {
      // Чип филиала под названием — только для филиальных строк журнала
      // (общевендорные branchBadge.shared не показываем).
      const badge = opts.showBranchLabel ? row.branchBadge : undefined
      const branchChip = badge && !badge.shared
        ? h(UiTag, { type: 'primary', size: 'small', secondary: true, style: 'margin-top: var(--space-4)' }, () => badge.label)
        : null

      return h('div', { class: 'entity-cell' }, [
        h('span', { class: 'entity-type' }, entityTypeLabel(row.entityType)),
        row.entityName
          ? h(UiText, { size: 'tiny', span: true, class: 'entity-name' }, () => row.entityName!)
          : h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => '—'),
        branchChip,
      ])
    },
  },
  {
    title: 'Изменения',
    key: 'changes',
    render: (row) => {
      // Order-строки несут готовую русскую сводку (status_changed → «Новый → Готов»):
      // показываем её одной строкой вместо diff'а полей.
      const changeSummary = row.changeSummary

      if (changeSummary) return h(UiText, { size: 'tiny', class: 'change-line' }, () => changeSummary)

      const changes = renderChanges(row)

      if (changes.length === 0) return h(UiText, { size: 'tiny', style: hintStyle }, () => '—')

      const LIMIT = 6
      const rows = changes.slice(0, LIMIT).map(renderChangeRow)

      if (changes.length > LIMIT) {
        rows.push(h(UiText, { size: 'tiny', class: 'change-line', style: hintStyle }, () => `… ещё ${changes.length - LIMIT}`))
      }

      return h('div', { class: 'changes-cell' }, rows)
    },
  },
  {
    title: 'Сотрудник',
    key: 'actorName',
    width: 170,
    render: (row) => {
      if (!row.actorName) return h(UiText, { size: 'tiny', style: hintStyle }, () => 'Система')

      return h('div', { class: 'actor-cell' }, [
        h(UiText, { size: 'tiny', span: true }, () => row.actorName!),
        row.actorRole ? h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => row.actorRole!) : null,
      ])
    },
  },
]
