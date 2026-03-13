<template>
  <UiDrawer
    :model-value="modelValue"
    :title="`Заказ #${shortId}`"
    :width="860"
    :actions="drawerActions"
    :on-confirm="onSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="order" class="content">

      <UiCollapse :expanded-names="['data']">

        <UiCollapseItem name="data" title="Заказ">
          <template #header-extra>
            <UiTag
              v-if="currentStatus"
              size="tiny"
              :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
            >{{ currentStatus.name }}</UiTag>
          </template>

          <div class="section-content">
            <!-- Статус -->
            <div v-if="statusMenuItems.length" class="status-row">
              <UiMenuDropdown
                :items="statusMenuItems"
                trigger="click"
                compact
                @item-click="form.status = $event"
              >
                <template #trigger>
                  <UiButton type="default" size="small">Сменить статус</UiButton>
                </template>
              </UiMenuDropdown>
            </div>

            <OrderFormFields
              :form="form"
              :tenant-id="tenantId"
              :subtotal="subtotal"
              :total="total"
              :permissions="can"
              :branch-options="branchOptions"
              :branch-id="selectedBranchId"
              @update:branch-id="selectedBranchId = $event"
            />

            <!-- Комментарий клиента (readonly) -->
            <div v-if="order.comment" class="comment-block">
              <UiAlert size="small" type="info" icon="messageCircle">{{ order.comment }}</UiAlert>
            </div>
          </div>
        </UiCollapseItem>

        <UiCollapseItem name="history" title="История">
          <OrderEventsSection
            :order-id="order.id"
            :refresh-key="notesRefreshKey"
          />
        </UiCollapseItem>

        <UiCollapseItem name="notes" title="Заметки">
          <OrderNotesSection
            :order-id="order.id"
            :tenant-id="tenantId"
            :refresh-key="notesRefreshKey"
          />
        </UiCollapseItem>

      </UiCollapse>

    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UiDrawer, UiCollapse, UiCollapseItem, UiMenuDropdown, UiAlert, UiTag, UiButton,
} from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useBranchStore } from '~/stores/branch'
import { useStatusColor } from '~/composables/ui/useStatusColor'
import { useOrderEventLogger } from '~/composables/data/useOrderEventLogger'
import OrderFormFields from './OrderFormFields.vue'
import OrderNotesSection from './OrderNotesSection.vue'
import OrderEventsSection from './OrderEventsSection.vue'

const props = defineProps<{
  modelValue: boolean
  order: Order | null
  tenantId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [order: Order]
}>()

const api = useDatabase()
const { logSaveEvents } = useOrderEventLogger()
const { statuses } = useOrderStatusesStore()
const branchStore = useBranchStore()
const { getStatusColor } = useStatusColor()

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))
const selectedBranchId = ref<string | null>(null)

const saving = ref(false)
const notesRefreshKey = ref(0)

const drawerActions = computed(() => [
  { text: 'Закрыть', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const shortId = computed(() => props.order?.id.slice(0, 6).toUpperCase() ?? '')

const currentStatus = computed(() => statuses.find((s) => s.id === form.status) ?? null)

const statusGroup = computed(() => currentStatus.value?.groupType ?? 'new')

const can = computed(() => {
  const g = statusGroup.value

  return {
    editCustomer: g === 'new' || g === 'in_progress',
    editDeliveryType: g === 'new',
    editAddress: g === 'new',
    editItems: g === 'new',
    editDeliveryFee: g === 'new' || g === 'in_progress',
    editPayment: g === 'new' || g === 'in_progress',
  }
})

const statusMenuItems = computed(() => statuses
  .filter((s) => s.id !== form.status)
  .map((s) => ({
    name: s.id,
    label: s.name,
    color: getStatusColor(s.id),
  })),
)

// ─── Form ─────────────────────────────────────────────────────────────────────

const buildForm = (o: Order) => ({
  status: o.status,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  deliveryType: o.deliveryType,
  address: o.address ?? '',
  items: o.items.map((i) => ({ ...i })),
  discountAmount: o.discountAmount,
  promoCode: o.promoCode ?? '',
  deliveryFee: o.deliveryFee,
  comment: o.comment ?? '',
  paymentType: o.paymentType,
})

const form = reactive({
  status: '',
  customerName: '',
  customerPhone: '',
  deliveryType: 'delivery' as Order['deliveryType'],
  address: '',
  items: [] as Order['items'],
  discountAmount: 0,
  promoCode: '',
  deliveryFee: 0,
  comment: '',
  paymentType: 'cash' as Order['paymentType'],
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.order) return
    Object.assign(form, buildForm(props.order))
    selectedBranchId.value = props.order.branchId
    notesRefreshKey.value++
  },
)

// ─── Computed totals ──────────────────────────────────────────────────────────

const subtotal = computed(() => form.items.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0))

const total = computed(() => subtotal.value - form.discountAmount + form.deliveryFee)

// ─── Save ─────────────────────────────────────────────────────────────────────

const onSave = async () => {
  if (!props.order) return false
  saving.value = true
  try {
    const updated = await api.orders.update(props.order.id, {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      items: form.items,
      deliveryType: form.deliveryType,
      address: form.address || null,
      comment: form.comment || null,
      discountAmount: form.discountAmount,
      promoCode: form.promoCode || null,
      subtotal: subtotal.value,
      deliveryFee: form.deliveryFee,
      total: total.value,
      status: form.status,
      paymentType: form.paymentType,
      branchId: selectedBranchId.value,
    })

    if (updated) {
      logSaveEvents(form, props.order!, statuses)
      emit('saved', updated)
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.comment-block {
  margin-top: 4px;
}
</style>
