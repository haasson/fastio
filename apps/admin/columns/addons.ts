import { h } from 'vue'
import { UiText, UiSwitch, UiTag, UiRowActions } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Addon, AddonPreset } from '@fastio/shared'

type AddonDeps = {
  onToggle: (id: string, active: boolean) => void
  onEdit: (row: Addon) => void
  onRemove: (row: Addon) => void
}

type AddonPresetDeps = {
  onEdit: (row: AddonPreset) => void
  onRemove: (row: AddonPreset) => void
  addonById: (id: string) => Addon | undefined
}

export const buildAddonColumns = (deps: AddonDeps): DataTableColumns<Addon> => {
  const { onToggle, onEdit, onRemove } = deps

  return [
    {
      title: 'Название',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (row) => h(UiText, { weight: 600 }, () => row.name),
    },
    {
      title: 'Цена',
      key: 'price',
      width: 110,
      sorter: (a, b) => a.price - b.price,
      render: (row) => h(UiText, { size: 'tiny' }, () => `${row.price} ₽`),
    },
    {
      title: 'Вес',
      key: 'weight',
      width: 100,
      sorter: (a, b) => (a.weight ?? 0) - (b.weight ?? 0),
      render: (row) => h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => row.weight ? `${row.weight} г` : '—'),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (row) => h(UiRowActions, { onEdit: () => onEdit(row), onDelete: () => onRemove(row) }, {
        prepend: () => h(UiSwitch, { 'modelValue': row.active, 'onUpdate:modelValue': (v: boolean) => onToggle(row.id, v) }),
      }),
    },
  ]
}

export const buildAddonPresetColumns = (deps: AddonPresetDeps): DataTableColumns<AddonPreset> => {
  const { onEdit, onRemove, addonById } = deps

  return [
    {
      title: 'Название',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (row) => h(UiText, { weight: 600 }, () => row.name),
    },
    {
      title: 'Добавки',
      key: 'addonIds',
      render: (row) => {
        if (row.addonIds.length === 0) {
          return h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => '—')
        }

        return h('div', { style: 'display: flex; flex-wrap: wrap; gap: 4px' },
          row.addonIds.map((id) => {
            const addon = addonById(id)

            return h(UiTag, { key: id, size: 'small', type: 'primary', empty: true, round: true }, () => addon ? `${addon.name} · ${addon.price} ₽` : id)
          }),
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (row) => h(UiRowActions, { onEdit: () => onEdit(row), onDelete: () => onRemove(row) }),
    },
  ]
}
