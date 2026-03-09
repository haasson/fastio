<template>
  <UiDrawer
    :model-value="modelValue"
    :title="`Заказ #${shortId}`"
    :width="860"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="order" class="content">

      <UiTabs
        v-model="activeTab"
        :tabs="tabs"
        prevent-compact
      />

      <!-- Данные заказа -->
      <template v-if="activeTab === 'data'">

        <!-- Статус -->
        <section class="section">
          <div class="section-label">Статус</div>
          <div class="status-row">
            <UiTag
              v-if="currentStatus"
              size="tiny"
              :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
            >{{ currentStatus.name }}</UiTag>
            <UiMenuDropdown
              v-if="statusMenuItems.length"
              :items="statusMenuItems"
              trigger="click"
              compact
              @item-click="form.status = $event"
            >
              <template #trigger>
                <UiButton type="default" size="small">Сменить</UiButton>
              </template>
            </UiMenuDropdown>
          </div>
        </section>

        <OrderFormFields
          :form="form"
          :tenant-id="tenantId"
          :subtotal="subtotal"
          :total="total"
          :permissions="can"
        />

        <!-- Комментарий клиента (readonly) -->
        <section v-if="order.comment" class="section">
          <div class="section-label">Комментарий клиента</div>
          <UiAlert size="small" type="info" icon="messageCircle">{{ order.comment }}</UiAlert>
        </section>

      </template>

      <!-- История -->
      <OrderEventsSection
        v-else-if="activeTab === 'history'"
        :order-id="order.id"
        :refresh-key="notesRefreshKey"
      />

      <!-- Заметки -->
      <OrderNotesSection
        v-else
        :order-id="order.id"
        :tenant-id="tenantId"
        :refresh-key="notesRefreshKey"
      />

    </div>

    <template v-if="activeTab === 'data'" #footer>
      <UiButton type="default" @click="$emit('update:modelValue', false)">Закрыть</UiButton>
      <UiButton type="primary" :loading="saving" @click="onSave">Сохранить</UiButton>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UiDrawer, UiTabs, UiButton, UiMenuDropdown, UiAlert, UiTag,
} from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useStatusColor } from '~/composables/useStatusColor'
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
const { getStatusColor } = useStatusColor()

const saving = ref(false)
const notesRefreshKey = ref(0)
const activeTab = ref<'data' | 'history' | 'notes'>('data')

const tabs = [
  { label: 'Заказ', value: 'data' },
  { label: 'История', value: 'history' },
  { label: 'Заметки', value: 'notes' },
]

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
  customerName: o.customer.name,
  customerPhone: o.customer.phone,
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
    activeTab.value = 'data'
    notesRefreshKey.value++
  },
)

// ─── Computed totals ──────────────────────────────────────────────────────────

const subtotal = computed(() => form.items.reduce((s, i) => s + i.price * i.quantity, 0))

const total = computed(() => subtotal.value - form.discountAmount + form.deliveryFee)

// ─── Save ─────────────────────────────────────────────────────────────────────

const onSave = async () => {
  if (!props.order) return false
  saving.value = true
  try {
    const updated = await api.orders.update(props.order.id, {
      customer: { name: form.customerName, phone: form.customerPhone },
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
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
