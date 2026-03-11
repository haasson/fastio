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
      <UiButton
        type="default"
        icon="plus"
        class="add-btn"
        @click="onAdd"
      >
        {{ mode === 'statuses' ? 'Добавить статус' : 'Добавить категорию' }}
      </UiButton>

      <VueDraggable
        v-model="localItems"
        handle=".drag-handle"
        :animation="180"
        ghost-class="row-ghost"
        @end="onReorder"
      >
        <div v-for="item in localItems" :key="item.id" class="item-row">
          <UiIcon name="grip" class="drag-handle" />

          <div v-if="mode === 'categories'" class="photo-thumb" @click="openPhotoModal(item.id)">
            <img v-if="photoPreview[item.id] || item.photoUrl" :src="photoPreview[item.id] ?? item.photoUrl!" alt="" />
            <UiPhotoPlaceholder v-else size="small" />
          </div>

          <input
            class="name-input"
            :value="item.name"
            @blur="onNameBlur(item, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />

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
    </div>
  </UiModal>

  <!-- Photo upload modal -->
  <UiModal
    v-model="photoModalOpen"
    title="Фото категории"
    :width="400"
    :actions="[]"
  >
    <PhotoUpload
      :key="photoModalItemId ?? undefined"
      :model-value="currentPhotoForModal"
      @update:model-value="onPhotoRemoved"
      @pending="onPhotoPending"
    />
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiModal, UiButton, UiIcon, UiSelect, UiPhotoPlaceholder } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { OrderStatusGroup } from '@fastio/shared'
import { STATUS_GROUP_LABELS } from '~/config/order-status-groups'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'

export type ManagedItem = {
  id: string
  name: string
  groupType?: OrderStatusGroup
  quickActions?: string[]
  photoUrl?: string | null
}

const props = defineProps<{
  modelValue: boolean
  title: string
  hint?: string
  width?: number
  items: ManagedItem[]
  mode: 'statuses' | 'categories'
  itemCounts?: Record<string, number>
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

// Photo modal state
const photoModalOpen = ref(false)
const photoModalItemId = ref<string | null>(null)

const currentPhotoForModal = computed(() => {
  if (!photoModalItemId.value) return null

  return photoPreview.value[photoModalItemId.value]
    ?? localItems.value.find((i) => i.id === photoModalItemId.value)?.photoUrl
    ?? null
})

const openPhotoModal = (itemId: string) => {
  photoModalItemId.value = itemId
  photoModalOpen.value = true
}

const onPhotoPending = (file: File | null) => {
  if (!photoModalItemId.value || !file) return
  const id = photoModalItemId.value

  if (photoPreview.value[id]?.startsWith('blob:')) URL.revokeObjectURL(photoPreview.value[id])
  photoPreview.value[id] = URL.createObjectURL(file)
  emit('updatePhoto', id, file)
}

const onPhotoRemoved = (value: string | null) => {
  if (!photoModalItemId.value || value !== null) return
  const id = photoModalItemId.value

  if (photoPreview.value[id]?.startsWith('blob:')) URL.revokeObjectURL(photoPreview.value[id])
  delete photoPreview.value[id]
  emit('removePhoto', id)
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
  color: var(--color-text-primary);
  outline: none;
  font-family: inherit;

  &:focus {
    border-color: var(--color-primary);
    background: var(--color-bg-primary, #fff);
  }
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
</style>
