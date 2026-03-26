import { h } from 'vue'
import { UiSwitch, UiTag, UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { ModifierGroup } from '@fastio/shared'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'

type Deps = {
  onToggle: (id: string, active: boolean) => void
  onEdit: (group: ModifierGroup) => void
  onRemove: (group: ModifierGroup) => void
}

export const buildModifierColumns = (deps: Deps): DataTableColumns<ModifierGroup> => {
  const { onToggle, onEdit, onRemove } = deps

  return [
    {
      title: 'Название',
      key: 'name',
      render: (row) => h(UiText, { size: 'small', weight: 500 }, () => row.name),
    },
    {
      title: 'Опции',
      key: 'options',
      render: (row) => {
        if (!row.options.length) {
          return h(UiText, { size: 'tiny', style: 'color: var(--color-text-tertiary)' }, () => 'Нет опций')
        }

        return h('div', { class: 'options-cell' },
          row.options.map((opt) => h(UiTag, { key: opt.id, size: 'small' }, () => opt.name)),
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (row) => h(AppActionsBlock, { onEdit: () => onEdit(row), onDelete: () => onRemove(row) }, {
        prepend: () => h(UiSwitch, { 'modelValue': row.active, 'onUpdate:modelValue': (v: boolean) => onToggle(row.id, v) }),
      }),
    },
  ]
}
