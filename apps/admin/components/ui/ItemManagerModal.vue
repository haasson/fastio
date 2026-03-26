<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    :title-hint="hint"
    :width="width ?? 550"
    :actions="[]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="manager-root">
      <div v-if="mode === 'categories'" class="add-row">
        <UiButton
          type="primary"
          icon="plus"
          class="add-btn"
          @click="onAdd"
        >
          Категория
        </UiButton>
        <UiButton
          type="default"
          icon="plus"
          class="add-btn"
          @click="showTagCategoryForm = true"
        >
          Спец-категория
        </UiButton>
      </div>
      <UiButton
        v-else
        type="default"
        icon="plus"
        class="add-btn"
        @click="onAdd"
      >
        Добавить статус
      </UiButton>

      <div v-if="showTagCategoryForm" class="tag-category-form">
        <UiInput v-model="tagCategoryName" placeholder="Название категории" size="small" />
        <UiSelect
          v-model:value="tagCategoryTagId"
          :options="tagOptions"
          size="small"
          placeholder="Выберите тег"
        />
        <div class="tag-category-actions">
          <UiButton
            size="tiny"
            type="primary"
            :disabled="!tagCategoryName.trim() || !tagCategoryTagId"
            @click="onAddTagCategory"
          >
            Создать
          </UiButton>
          <UiButton size="tiny" @click="showTagCategoryForm = false">
            Отмена
          </UiButton>
        </div>
      </div>

      <VueDraggable
        v-model="localItems"
        :group="{ name: 'categories-manager', put: true }"
        handle=".drag-handle"
        :animation="180"
        ghost-class="row-ghost"
        @update="onReorder"
        @add="onPaletteAdd"
      >
        <div v-for="item in localItems" :key="item.id" class="item-row">
          <UiIcon name="grip" class="drag-handle" />

          <div v-if="mode === 'categories'" class="photo-thumb" @click="item.type && item.type !== 'regular' ? null : openPhotoModal(item.id)">
            <img v-if="photoPreview[item.id] || item.photoUrl" :src="photoPreview[item.id] ?? item.photoUrl!" alt="" />
            <UiPhotoPlaceholder v-else size="small" />
          </div>

          <input
            class="name-input"
            :value="item.name"
            :readonly="!!(item.type && item.type !== 'regular')"
            :class="{ readonly: item.type && item.type !== 'regular' }"
            @blur="onNameBlur(item, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />

          <span v-if="mode === 'categories' && item.tagId" class="tag-badge">
            {{ tagLabel(item.tagId) }}
          </span>

          <UiSelect
            v-if="mode === 'statuses'"
            :value="item.groupType"
            :options="groupOptions"
            size="tiny"
            class="group-select"
            @update:value="onGroupChange(item, $event as OrderStatusGroup)"
          />

          <UiSelect
            v-if="mode === 'statuses'"
            :value="(item.quickActions ?? [])[0] ?? null"
            :options="getQuickActionOptions(item.id, 0)"
            size="tiny"
            class="action-select"
            clearable
            placeholder="Кнопка 1"
            @update:value="onQuickActionChange(item, 0, $event as string | null)"
          />

          <UiSelect
            v-if="mode === 'statuses'"
            :value="(item.quickActions ?? [])[1] ?? null"
            :options="getQuickActionOptions(item.id, 1)"
            size="tiny"
            class="action-select"
            clearable
            :disabled="!(item.quickActions ?? [])[0]"
            placeholder="Кнопка 2"
            @update:value="onQuickActionChange(item, 1, $event as string | null)"
          />

          <UiButton
            type="text"
            size="tiny"
            icon="trash"
            class="delete-btn"
            @click="confirmRemove(item)"
          />
        </div>
      </VueDraggable>

      <!-- Special categories palette -->
      <div v-if="mode === 'categories' && paletteItems.length > 0" class="palette-section">
        <span class="palette-title">Специальные категории</span>
        <span class="palette-label">Перетащите в список или нажмите</span>
        <VueDraggable
          v-model="paletteItems"
          :group="{ name: 'categories-manager', pull: 'clone', put: false }"
          :sort="false"
          class="palette"
        >
          <div
            v-for="item in paletteItems"
            :key="item.id"
            class="palette-item"
            @click="onPaletteClick(item)"
          >
            <UiIcon name="grip" class="palette-grip" />
            <span class="palette-name">{{ item.label }}</span>
          </div>
        </VueDraggable>
      </div>
    </div>
  </UiModal>

  <ImageUploadModal
    v-model="photoModalOpen"
    title="Фото категории"
    aspect-ratio="4:3"
    @done="onPhotoDone"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiModal, UiButton, UiIcon, UiInput, UiSelect, UiPhotoPlaceholder } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { OrderStatusGroup, SpecialCategoryType, CategoryType, DishTagDefinition } from '@fastio/shared'
import { CATEGORY_TYPE_LABELS } from '@fastio/shared'
import { STATUS_GROUP_LABELS } from '~/config/order-status-groups'
import ImageUploadModal from '~/components/ui/ImageUploadModal.vue'

export type ManagedItem = {
  id: string
  name: string
  type?: CategoryType
  tagId?: string | null
  groupType?: OrderStatusGroup
  quickActions?: string[]
  photoUrl?: string | null
}

type PaletteItem = {
  id: string
  _palette: true
  type: SpecialCategoryType
  label: string
}

const props = defineProps<{
  modelValue: boolean
  title: string
  hint?: string
  width?: number
  items: ManagedItem[]
  mode: 'statuses' | 'categories'
  itemCounts?: Record<string, number>
  availableSpecialTypes?: SpecialCategoryType[]
  availableTags?: DishTagDefinition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'add': [data: Partial<ManagedItem>]
  'update': [id: string, data: Partial<ManagedItem>]
  'remove': [id: string]
  'reorder': [items: ManagedItem[]]
  'updatePhoto': [id: string, file: File]
  'removePhoto': [id: string]
}>()

const localItems = ref<ManagedItem[]>([])
const photoPreview = ref<Record<string, string>>({})

// Special type palette — computed from available types, but needs to be a ref for VueDraggable
const paletteItems = computed<PaletteItem[]>(() => (props.availableSpecialTypes ?? []).map((type) => ({
  id: `_palette_${type}`,
  _palette: true as const,
  type,
  label: CATEGORY_TYPE_LABELS[type],
})),
)

const onPaletteAdd = () => {
  const idx = localItems.value.findIndex((i) => (i as unknown as PaletteItem)._palette)

  if (idx === -1) return
  const item = localItems.value[idx] as unknown as PaletteItem

  localItems.value.splice(idx, 1)
  emit('add', { name: item.label, type: item.type })
}

const onPaletteClick = (item: PaletteItem) => {
  emit('add', { name: item.label, type: item.type })
}

// Photo modal state
const photoModalOpen = ref(false)
const photoModalItemId = ref<string | null>(null)

const openPhotoModal = (itemId: string) => {
  photoModalItemId.value = itemId
  photoModalOpen.value = true
}

const onPhotoDone = (file: File) => {
  if (!photoModalItemId.value) return
  const id = photoModalItemId.value

  if (photoPreview.value[id]?.startsWith('blob:')) URL.revokeObjectURL(photoPreview.value[id])
  photoPreview.value[id] = URL.createObjectURL(file)
  emit('updatePhoto', id, file)
}

watch(() => props.items, (items) => {
  localItems.value = items.map((i) => ({ ...i }))
}, { immediate: true, deep: true })

watch(() => props.modelValue, (val) => {
  if (!val) {
    Object.values(photoPreview.value).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    })
    photoPreview.value = {}
    photoModalOpen.value = false
    showTagCategoryForm.value = false
    tagCategoryName.value = ''
    tagCategoryTagId.value = null
  }
})

onUnmounted(() => {
  Object.values(photoPreview.value).forEach((url) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
})

const groupOptions = (Object.keys(STATUS_GROUP_LABELS) as OrderStatusGroup[]).map((key) => ({
  label: STATUS_GROUP_LABELS[key],
  value: key,
}))

const { confirm } = useConfirm()

const onNameBlur = (item: ManagedItem, event: Event) => {
  if (item.type && item.type !== 'regular') return
  const newName = (event.target as HTMLInputElement).value.trim()

  if (!newName || newName === item.name) return
  item.name = newName
  emit('update', item.id, { name: newName })
}

const onGroupChange = (item: ManagedItem, groupType: OrderStatusGroup) => {
  item.groupType = groupType
  emit('update', item.id, { groupType })
}

const getQuickActionOptions = (currentId: string, slotIndex: number) => {
  const current = localItems.value.find((i) => i.id === currentId)
  const actions = current?.quickActions ?? []
  const otherSlotValue = actions[slotIndex === 0 ? 1 : 0]

  return localItems.value
    .filter((i) => i.id !== currentId)
    .map((i) => ({
      label: i.name,
      value: i.id,
      disabled: i.id === otherSlotValue,
    }))
}

const onQuickActionChange = (item: ManagedItem, slotIndex: number, value: string | null) => {
  const actions = [...(item.quickActions ?? [])]

  if (value) {
    actions[slotIndex] = value
  } else {
    actions.splice(slotIndex, 1)
  }
  const quickActions = actions.filter(Boolean) as string[]

  item.quickActions = quickActions
  emit('update', item.id, { quickActions })
}

const tagOptions = computed(() => (props.availableTags ?? []).map((t) => ({ label: t.name, value: t.id })),
)

const tagLabel = (tagId: string) => props.availableTags?.find((t) => t.id === tagId)?.name ?? ''

const showTagCategoryForm = ref(false)
const tagCategoryName = ref('')
const tagCategoryTagId = ref<string | null>(null)

const onAddTagCategory = () => {
  if (!tagCategoryName.value.trim() || !tagCategoryTagId.value) return
  emit('add', { name: tagCategoryName.value.trim(), tagId: tagCategoryTagId.value })
  tagCategoryName.value = ''
  tagCategoryTagId.value = null
  showTagCategoryForm.value = false
}

const onReorder = () => {
  emit('reorder', [...localItems.value])
}

const onAdd = () => {
  const defaults: Partial<ManagedItem> = {
    name: props.mode === 'statuses' ? 'Новый статус' : 'Новая категория',
  }

  if (props.mode === 'statuses') defaults.groupType = 'new'
  emit('add', defaults)
}

const confirmRemove = async (item: ManagedItem) => {
  const count = props.itemCounts?.[item.id] ?? 0
  const hasChildren = count > 0
  const childLabel = props.mode === 'statuses' ? 'заказов' : 'блюд'

  const ok = await confirm({
    title: `Удалить «${item.name}»?`,
    confirmText: 'Удалить',
    confirmType: 'error',
    ...(hasChildren && {
      alert: `В этом элементе ${count} ${childLabel}. Сначала перенесите их.`,
      confirmDisabled: true,
    }),
  })

  if (ok) emit('remove', item.id)
}
</script>

<style scoped lang="scss">
.manager-root {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-bg-secondary, var(--n-color));

  &:not(:last-child) {
    margin-bottom: 6px;
  }
}

.row-ghost {
  opacity: 0.4;
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary);
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

.name-input {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  background: transparent;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--color-text);
  outline: none;
  font-family: inherit;

  &:focus:not(.readonly) {
    border-color: var(--color-primary);
  }

  &.readonly {
    cursor: default;
    color: var(--color-text-secondary);
  }
}

.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;

  .add-btn {
    flex: 1;
    margin-bottom: 0;
  }
}

.tag-badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--color-fill-quaternary);
  color: var(--color-text-secondary);
}

.tag-category-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-fill-quaternary);
  margin-bottom: 8px;
}

.tag-category-actions {
  display: flex;
  gap: 8px;
}

.group-select {
  flex-shrink: 0;
  width: 140px;
}

.action-select {
  flex-shrink: 0;
  width: 130px;
}

.delete-btn {
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
}

.photo-thumb {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.add-btn {
  width: 100%;
  margin-bottom: 8px;
}

// Palette
.palette-section {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px dashed var(--color-border);
}

.palette-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.palette-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px dashed var(--color-border);
  cursor: grab;
  user-select: none;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-primary);
  }

  &:active {
    cursor: grabbing;
  }
}

.palette-grip {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.palette-name {
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
