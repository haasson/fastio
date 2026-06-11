import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import type { VNodeChild } from 'vue'
import type { DataTableColumn } from '@fastio/ui'
import { auditLogColumns } from '../audit-columns'
import type { AuditColumnsOptions } from '../audit-columns'
import type { JournalRow } from '../journal-row'

const makeRow = (over: Partial<JournalRow> = {}): JournalRow => ({
  id: 'a1',
  tenantId: 't1',
  actorId: 'u1',
  actorName: 'Иван',
  actorRole: 'Администратор',
  action: 'updated',
  entityType: 'dish',
  entityId: 'd1',
  entityName: 'Борщ',
  payload: { name: { old: 'А', new: 'Б' } },
  changedFields: ['name'],
  parentType: null,
  parentId: null,
  createdAt: '2026-06-10T10:00:00Z',
  branchBadge: { label: 'Всё заведение', shared: true },
  ...over,
})

type ColumnWithRender = DataTableColumn<JournalRow> & {
  key?: string
  render?: (row: JournalRow, index: number) => VNodeChild
}

const columnByKey = (key: string, opts: AuditColumnsOptions = {}): ColumnWithRender => {
  const col = (auditLogColumns(opts) as ColumnWithRender[]).find((c) => c.key === key)

  if (!col) throw new Error(`колонка «${key}» не найдена`)

  return col
}

const mountCell = (column: ColumnWithRender, row: JournalRow) => {
  if (!column.render) throw new Error(`у колонки «${String(column.key)}» нет render`)

  const render = column.render

  return mount(defineComponent({ render: () => render(row, 0) }))
}

describe('auditLogColumns', () => {
  it('возвращает 5 колонок в порядке дата/действие/объект/изменения/сотрудник', () => {
    const keys = (auditLogColumns() as ColumnWithRender[]).map((c) => c.key)

    expect(keys).toEqual(['createdAt', 'action', 'entityName', 'changes', 'actorName'])
  })

  describe('колонка «Действие»', () => {
    it('created-строка: лейбл «Создано» с точкой', () => {
      const cell = mountCell(
        columnByKey('action'),
        makeRow({ action: 'created', changedFields: [], payload: {} }),
      )

      expect(cell.find('[data-testid="action-label"]').text()).toBe('Создано')
      expect(cell.find('[data-testid="action-dot"]').exists()).toBe(true)
    })

    it('updated-строка: тихое «Изменено» без точки', () => {
      const cell = mountCell(columnByKey('action'), makeRow())

      expect(cell.find('[data-testid="action-label"]').text()).toBe('Изменено')
      expect(cell.find('[data-testid="action-dot"]').exists()).toBe(false)
    })

    it('restored-строка: лейбл «Восстановлено» с точкой', () => {
      const cell = mountCell(columnByKey('action'), makeRow({ action: 'restored' }))

      expect(cell.find('[data-testid="action-label"]').text()).toBe('Восстановлено')
      expect(cell.find('[data-testid="action-dot"]').exists()).toBe(true)
    })
  })

  describe('колонка «Изменения»', () => {
    it('created-строка без диффа: прочерк, маркера действия в ячейке нет', () => {
      const cell = mountCell(
        columnByKey('changes'),
        makeRow({ action: 'created', changedFields: [], payload: {} }),
      )

      expect(cell.text()).toBe('—')
      expect(cell.find('[data-testid="action-label"]').exists()).toBe(false)
    })

    it('updated-строка с диффом: рендерит дельту', () => {
      const cell = mountCell(columnByKey('changes'), makeRow())

      expect(cell.find('[data-testid="change"]').exists()).toBe(true)
      expect(cell.text()).toContain('Название')
    })

    it('updated-строка без диффа: прочерк', () => {
      const cell = mountCell(
        columnByKey('changes'),
        makeRow({ changedFields: [], payload: {} }),
      )

      expect(cell.text()).toBe('—')
    })

    it('больше 6 дельт: рендерит 6 + хвост «… ещё N»', () => {
      const fields = ['name', 'code', 'title', 'description', 'address', 'phone', 'comment', 'slug']
      const payload = Object.fromEntries(fields.map((f, i) => [f, { old: `до-${i}`, new: `после-${i}` }]))
      const cell = mountCell(
        columnByKey('changes'),
        makeRow({ changedFields: fields, payload }),
      )

      expect(cell.findAll('[data-testid="change"]')).toHaveLength(6)
      expect(cell.text()).toContain('… ещё 2')
    })

    it('restored-строка с диффом: только дельты, без маркера действия', () => {
      const cell = mountCell(
        columnByKey('changes'),
        makeRow({ action: 'restored' }),
      )

      expect(cell.find('[data-testid="change"]').exists()).toBe(true)
      expect(cell.find('[data-testid="action-label"]').exists()).toBe(false)
    })

    it('order-строка с changeSummary: сводка одной строкой', () => {
      const cell = mountCell(
        columnByKey('changes'),
        makeRow({ entityType: 'order', changedFields: [], payload: {}, changeSummary: 'Новый → Готов' }),
      )

      expect(cell.text()).toContain('Новый → Готов')
    })
  })

  describe('колонка «Объект»', () => {
    it('showBranchLabel + филиальная строка: чип с именем филиала', () => {
      const cell = mountCell(
        columnByKey('entityName', { showBranchLabel: true }),
        makeRow({ branchBadge: { label: 'Центр', shared: false } }),
      )

      expect(cell.find('[data-testid="entity-branch"]').text()).toContain('Центр')
    })

    it('showBranchLabel + общая строка (shared): чипа нет', () => {
      const cell = mountCell(
        columnByKey('entityName', { showBranchLabel: true }),
        makeRow({ branchBadge: { label: 'Всё заведение', shared: true } }),
      )

      expect(cell.find('[data-testid="entity-branch"]').exists()).toBe(false)
    })
  })

  describe('колонка «Сотрудник»', () => {
    it('actorName null: показывает «Система»', () => {
      const cell = mountCell(
        columnByKey('actorName'),
        makeRow({ actorName: null, actorRole: null }),
      )

      expect(cell.find('[data-testid="actor-name"]').text()).toBe('Система')
    })

    it('actorEmail задан: email рендерится в ячейке под именем', () => {
      const cell = mountCell(
        columnByKey('actorName'),
        makeRow({ actorEmail: 'ivan@example.com' }),
      )

      expect(cell.find('[data-testid="actor-email"]').text()).toBe('ivan@example.com')
    })

    it('actorEmail отсутствует: ноды email нет', () => {
      const cell = mountCell(columnByKey('actorName'), makeRow())

      expect(cell.find('[data-testid="actor-email"]').exists()).toBe(false)
    })
  })
})
