<template>
  <div class="statuses-root">
    <UiSectionHeader title="Статусы" editable @edit="managerOpen = true" />

    <UiTabs
      :model-value="modelValue ?? ''"
      :tabs="statusTabs"
      @update:model-value="$emit('update:modelValue', String($event))"
    />

    <ItemManagerModal
      v-model="managerOpen"
      title="Статусы"
      :width="750"
      hint="Перетаскивайте статусы для изменения порядка. Группа определяет поведение заказа. Быстрые действия — кнопки перехода в другой статус (макс. 2), отображаются на карточке заказа."
      mode="statuses"
      :items="managerItems"
      :item-counts="orderCounts"
      @add="handleAdd"
      @update="handleUpdate"
      @remove="handleRemove"
      @reorder="handleReorder"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiTabs } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import ItemManagerModal from '~/components/ui/ItemManagerModal.vue'
import type { ManagedItem } from '~/components/ui/ItemManagerModal.vue'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'

const props = defineProps<{
  modelValue: string | null
  orderCounts: Record<string, number>
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
}>()

const statusesStore = useOrderStatusesStore()
const { statuses } = storeToRefs(statusesStore)
const { add: addStatus, update: updateStatus, remove: removeStatus, reorder: reorderStatuses } = statusesStore

const statusTabs = computed(() => statuses.value.map((s) => ({
  value: s.id,
  label: s.name,
  type: STATUS_GROUP_TAG_TYPES[s.groupType],
  count: props.orderCounts[s.id] ?? 0,
})))

const managerOpen = ref(false)

const managerItems = computed<ManagedItem[]>(() => statuses.value.map((s) => ({
  id: s.id,
  name: s.name,
  groupType: s.groupType,
  quickActions: s.quickActions,
})),
)

const handleAdd = async (data: Partial<ManagedItem>) => {
  await addStatus({ name: data.name!, groupType: data.groupType! })
}

const handleUpdate = async (id: string, data: Partial<ManagedItem>) => {
  await updateStatus(id, data)
}

const handleRemove = async (id: string) => {
  if (props.modelValue === id) emit('update:modelValue', null)
  await removeStatus(id)
}

const handleReorder = async (items: ManagedItem[]) => {
  await reorderStatuses(items.map((item, i) => ({
    ...statuses.value.find((s) => s.id === item.id)!,
    position: i,
  })))
}
</script>

<style scoped lang="scss">
.statuses-root {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
