import { computed, ref, h, type Ref } from 'vue'
import { UiPhotoPlaceholder, UiText, UiTag, UiSwitch, UiRowActions } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Dish, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useTagDisplay } from '~/features/catalog'
import { useItemVariant } from '~/shared/composables/useItemVariant'

type Actions = {
  onEdit: (dish: Dish) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
  tags: Ref<DishTagDefinition[]>
}

export function useDishTable(dishes: Ref<Dish[]>, actions: Actions) {
  const searchQuery = ref('')
  const { variant: placeholderVariant } = useItemVariant()

  const filteredDishes = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()

    if (!q) return dishes.value

    return dishes.value.filter((d) => d.name.toLowerCase().includes(q))
  })

  const { tagName, tagStyleString } = useTagDisplay(actions.tags)

  const tagFilterOptions = computed(() => actions.tags.value.map((t) => ({ label: t.name, value: t.id })),
  )

  const tableColumns = computed<DataTableColumns<Dish>>(() => [
    {
      title: '',
      key: 'photo',
      width: 56,
      render: (row) => row.photos[0]
        ? h('img', { src: row.photos[0], alt: row.name, style: 'width:40px;height:40px;border-radius:8px;object-fit:cover;display:block' })
        : h(UiPhotoPlaceholder, { size: 'small', variant: placeholderVariant.value }),
    },
    {
      title: 'Название',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (row) => h(UiText, { size: 'small', style: 'font-weight: 600' }, () => row.name),
    },
    {
      title: 'Цена',
      key: 'price',
      width: 100,
      sorter: (a, b) => a.price - b.price,
      render: (row) => h(UiText, { size: 'small', style: 'font-weight: 700; color: var(--color-primary)' }, () => formatPrice(row.price)),
    },
    {
      title: 'Теги',
      key: 'tags',
      width: 200,
      filterOptions: tagFilterOptions.value,
      filter: (value, row) => row.tags.includes(value as string),
      render: (row) => h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' },
        row.tags.map((tagId) => h(UiTag, { key: tagId, size: 'tiny', empty: true, round: true, style: tagStyleString(tagId) }, () => tagName(tagId)),
        ),
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (row) => h(UiRowActions, {
        onEdit: () => actions.onEdit(row),
        onDelete: () => actions.onDelete(row.id),
      }, {
        prepend: () => h(UiSwitch, {
          'modelValue': row.active,
          'onUpdate:modelValue': (v: boolean) => actions.onToggleActive(row.id, v),
        }),
      }),
    },
  ])

  return { searchQuery, filteredDishes, tableColumns }
}
