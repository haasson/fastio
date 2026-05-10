<template>
  <UiDrawer
    :model-value="modelValue"
    :title="isEdit ? `Заказ #${props.order?.orderNumber}` : 'Новый заказ'"
    :width="860"
    :actions="drawerActions"
    :on-confirm="() => contentRef?.save()"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template v-if="isEdit" #title>
      <span>Заказ #{{ order?.orderNumber }}</span>
      <UiIcon
        name="externalLink"
        :size="14"
        class="new-tab-icon"
        :title="`Открыть заказ #${order?.orderNumber} в новой вкладке`"
        @click="openInNewTab"
      />
    </template>

    <OrderContent
      :key="instanceKey"
      ref="contentRef"
      :order="order"
      :tenant-id="tenantId"
      :branch-id="branchId"
      :table-id="tableId"
      :table-name="tableName"
      @saved="onSaved"
    />
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiDrawer } from '@fastio/ui'
import { UiIcon } from '@fastio/icons'
import type { Order } from '@fastio/shared'
import OrderContent from './OrderContent.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  order: Order | null
  branchId?: string | null
  tableId?: string | null
  tableName?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [order: Order]
}>()

const contentRef = ref<InstanceType<typeof OrderContent> | null>(null)
const instanceKey = ref(0)

const isEdit = computed(() => !!props.order)

watch(() => props.modelValue, (open) => {
  if (open) instanceKey.value++
})

const drawerActions = computed(() => [
  { text: 'Закрыть', type: 'default' as const, actionType: 'decline' as const },
  {
    text: isEdit.value ? 'Сохранить' : 'Создать',
    type: 'primary' as const,
    actionType: 'confirm' as const,
    loading: contentRef.value?.saving ?? false,
  },
])

const openInNewTab = () => window.open(`/orders/${props.order!.id}`, '_blank')

const onSaved = (order: Order) => emit('saved', order)
</script>

<style scoped lang="scss">
.new-tab-icon {
  margin-left: var(--space-8);
  color: var(--color-text-hint);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text-secondary);
  }
}
</style>
