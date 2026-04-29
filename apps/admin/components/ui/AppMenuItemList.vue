<template>
  <main class="list-root">
    <UiEmpty v-if="!categoryId" :icon="emptyIcon" :text="emptyHintText" />

    <template v-else>
      <UiSectionHeader :title="title">
        <template #left>
          <div class="header-left">
            <UiSegmentedControl
              v-model="view"
              :items="viewItems"
              size="medium"
            />
            <template v-if="view === 'table'">
              <UiDivider vertical />
              <UiInput
                v-model:value="searchQuery"
                placeholder="Поиск по названию…"
                clearable
                size="medium"
                class="search"
              />
            </template>
          </div>
        </template>
        <template #right>
          <UiButton
            :data-tour="addDataTour"
            size="medium"
            type="primary"
            icon="plus"
            @click="$emit('add')"
          >Добавить</UiButton>
        </template>
      </UiSectionHeader>

      <div class="content-wrap">
        <Transition name="fade" mode="out-in">
          <div :key="`${categoryId}-${view}`" class="content-inner">
            <UiSkeleton v-if="loading" text :repeat="6" />

            <template v-else>
              <UiEmpty v-if="items.length === 0" :icon="emptyIcon" :text="emptyText" />

              <template v-else>
                <div v-if="view === 'cards'" class="cards-grid">
                  <MenuItemCard
                    v-for="it in items"
                    :key="it.id"
                    :photo="it.photos[0]"
                    :name="it.name"
                    :price="it.price"
                    :tags="it.tags"
                    :active="it.active"
                    :tag-name="tagName"
                    :tag-style="tagStyle"
                    @click="$emit('edit', it)"
                    @toggle-active="$emit('toggleActive', it.id, $event)"
                    @delete="$emit('delete', it.id)"
                  />
                </div>

                <template v-else-if="view === 'table'">
                  <UiEmpty
                    v-if="filteredItems.length === 0"
                    :icon="emptyIcon"
                    text="Ничего не найдено"
                  />
                  <UiDataTable
                    v-else
                    :columns="tableColumns"
                    :data="filteredItems"
                    :row-key="rowKey"
                    :bordered="false"
                    size="small"
                  />
                </template>

                <AppDraggableList
                  v-else-if="view === 'order'"
                  v-model="localItems"
                  @reorder="$emit('reorder', localItems as T[])"
                >
                  <AppListRow
                    v-for="it in localItems"
                    :key="it.id"
                    :name="it.name"
                    :thumb-url="it.photos[0] ?? null"
                    thumb-width="40px"
                    thumb-height="40px"
                    :disabled="!it.active"
                  >
                    <template #append>
                      <span class="order-price">{{ formatPrice(it.price) }}</span>
                    </template>
                  </AppListRow>
                </AppDraggableList>
              </template>
            </template>
          </div>
        </Transition>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts" generic="T extends { id: string; name: string; price: number; photos: string[]; tags: string[]; active: boolean }">
import { computed, ref, h, watch, watchEffect, type Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import {
  UiButton, UiDataTable, UiDivider, UiEmpty, UiInput,
  UiSectionHeader, UiSegmentedControl, UiSkeleton,
  UiPhotoPlaceholder, UiText, UiTag, UiSwitch,
} from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import type { IconName } from '@fastio/icons'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import MenuItemCard from '~/components/menu/ItemCard.vue'
import { useTagDisplay } from '~/composables/ui/useTagDisplay'
import { useItemVariant } from '~/composables/useItemVariant'

type ViewKind = 'cards' | 'table' | 'order'

const props = withDefaults(defineProps<{
  items: T[]
  loading: boolean
  categoryId: string | null
  tags: DishTagDefinition[]
  title: string
  emptyIcon?: IconName
  emptyHintText?: string
  emptyText?: string
  storageKey: string
  enabledViews?: ViewKind[]
  addDataTour?: string
}>(), {
  emptyIcon: 'dishes',
  emptyHintText: 'Выберите категорию',
  emptyText: 'Здесь пока пусто',
  enabledViews: () => ['cards', 'table', 'order'],
  addDataTour: undefined,
})

const emit = defineEmits<{
  add: []
  edit: [item: T]
  delete: [id: string]
  toggleActive: [id: string, active: boolean]
  reorder: [items: T[]]
}>()

const VIEW_LABELS: Record<ViewKind, string> = {
  cards: 'Карточки',
  table: 'Таблица',
  order: 'Порядок',
}

const viewItems = computed(() => props.enabledViews.map((v) => ({ label: VIEW_LABELS[v], value: v })))

const view = useLocalStorage<ViewKind>(props.storageKey, props.enabledViews[0] ?? 'cards')

watchEffect(() => {
  if (!props.enabledViews.includes(view.value)) view.value = props.enabledViews[0] ?? 'cards'
})

const searchQuery = ref('')
const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  if (!q) return props.items

  return props.items.filter((i) => i.name.toLowerCase().includes(q))
})

const tagsRef = computed(() => props.tags)
const { tagName, tagStyle, tagStyleString } = useTagDisplay(tagsRef)
const { variant: placeholderVariant } = useItemVariant()

const tagFilterOptions = computed(() => props.tags.map((t) => ({ label: t.name, value: t.id })))

const tableColumns = computed<DataTableColumns<T>>(() => [
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
      row.tags.map((tagId: string) => h(UiTag, { key: tagId, size: 'tiny', empty: true, round: true, style: tagStyleString(tagId) }, () => tagName(tagId)),
      ),
    ),
  },
  {
    title: '',
    key: 'actions',
    width: 110,
    render: (row) => h(AppActionsBlock, {
      onEdit: () => emit('edit', row),
      onDelete: () => emit('delete', row.id),
    }, {
      prepend: () => h(UiSwitch, {
        'modelValue': row.active,
        'onUpdate:modelValue': (v: boolean) => emit('toggleActive', row.id, v),
      }),
    }),
  },
])

const rowKey = (row: T) => row.id

const localItems = ref<T[]>([]) as Ref<T[]>

watch(() => props.items, (v) => {
  localItems.value = v.slice()
}, { immediate: true })
</script>

<style scoped lang="scss">
.list-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--space-12);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.search {
  width: 220px;
}

.content-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: var(--space-4);
}

.content-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-8);

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.order-price {
  flex-shrink: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
