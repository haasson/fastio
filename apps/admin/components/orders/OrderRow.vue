<template>
  <div class="row-root">
    <div class="left">
      <span class="number">#{{ shortId }}</span>
      <UiTag
        :type="order.deliveryType === 'delivery' ? 'primary' : 'success'"
        secondary
        size="tiny"
        :icon="order.deliveryType === 'delivery' ? 'bike' : undefined"
      >
        {{ order.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз' }}
      </UiTag>
      <UiTag v-if="branchName" size="tiny">{{ branchName }}</UiTag>
    </div>

    <div class="customer">
      <span class="customer-name">{{ order.customer.name }}</span>
      <span class="customer-phone">{{ order.customer.phone }}</span>
    </div>

    <div class="items-summary">{{ itemsSummary }}</div>

    <div class="right">
      <span class="time">{{ relativeTime }}</span>
      <span class="total">{{ order.total }} ₽</span>
      <UiTag
        v-if="currentStatus"
        size="tiny"
        :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
      >{{ currentStatus.name }}</UiTag>

      <UiMenuDropdown
        v-if="statuses.length"
        :items="statusMenuItems"
        trigger="click"
        compact
        @item-click="emit('status-change', order.id, $event)"
      >
        <template #trigger>
          <UiButton type="default" size="tiny" :disabled="updating">
            Сменить
          </UiButton>
        </template>
      </UiMenuDropdown>

      <UiButton
        type="text"
        size="tiny"
        icon="pencil"
        @click="emit('open-edit', order)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiButton, UiIcon, UiMenuDropdown, UiTag, COLORS } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import { STATUS_GROUP_COLORS, STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'

const props = defineProps<{
  order: Order
  updating?: boolean
  branchName?: string
  statuses: OrderStatus[]
}>()

const emit = defineEmits<{
  'status-change': [id: string, statusId: string]
  'open-edit': [order: Order]
}>()

const shortId = computed(() => props.order.id.slice(0, 6).toUpperCase())

const currentStatus = computed(() => props.statuses.find((s) => s.id === props.order.status) ?? null,
)

const statusColor = computed(() => currentStatus.value ? STATUS_GROUP_COLORS[currentStatus.value.groupType] : COLORS.GREY_500,
)

const statusMenuItems = computed(() => props.statuses
  .filter((s) => s.id !== props.order.status)
  .map((s) => ({
    name: s.id,
    label: s.name,
    color: STATUS_GROUP_COLORS[s.groupType],
  })),
)

const itemsSummary = computed(() => props.order.items.map((i) => `${i.dishName} × ${i.quantity}`).join(', '),
)

const now = useNow({ interval: 30_000 })
const relativeTime = computed(() => {
  const diff = now.value.getTime() - new Date(props.order.createdAt).getTime()
  const min = Math.floor(diff / 60_000)

  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)

  if (h < 24) return `${h} ч`

  return new Date(props.order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
})
</script>

<style scoped lang="scss">
.row-root {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--color-bg-card);
  border-radius: 10px;
  min-width: 0;
}

.left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.number {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-title);
  font-variant-numeric: tabular-nums;
}

.customer {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
  width: 150px;
}

.customer-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-phone {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.items-summary {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.total {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-title);
  min-width: 60px;
  text-align: right;
}

</style>
