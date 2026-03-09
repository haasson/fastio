<template>
  <UiModal
    :model-value="modelValue"
    :title="`Заказ #${shortId}`"
    :width="660"
    :loading="saving"
    :actions="modalActions"
    :on-confirm="onSave"
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

        <!-- Клиент -->
        <section class="section">
          <div class="section-label">Клиент</div>
          <div class="fields-row">
            <UiInput
              v-model="form.customerName"
              label="Имя"
              placeholder="Иван Иванов"
              :disabled="!can.editCustomer"
            />
            <UiInput
              v-model="form.customerPhone"
              label="Телефон"
              placeholder="+7 999 000 00 00"
              :disabled="!can.editCustomer"
            />
          </div>
        </section>

        <!-- Доставка -->
        <section class="section">
          <div class="section-label">Доставка</div>
          <div :class="{ 'field-disabled': !can.editDeliveryType }">
            <UiSegmentedControl
              v-model="form.deliveryType"
              :items="deliveryItems"
              size="medium"
            />
          </div>
          <UiInput
            v-if="form.deliveryType === 'delivery'"
            v-model="form.address"
            label="Адрес"
            placeholder="ул. Пушкина, д. 10, кв. 5"
            :disabled="!can.editAddress"
            class="mt"
          />
        </section>

        <!-- Состав -->
        <OrderItemsSection
          :items="form.items"
          :tenant-id="tenantId"
          :readonly="!can.editItems"
          @update:items="form.items = $event"
        />

        <!-- Итого -->
        <section class="section totals-section">
          <div class="total-line">
            <span class="total-key">Сумма</span>
            <span class="total-val">{{ subtotal }} ₽</span>
          </div>
          <div v-if="form.discountAmount > 0" class="total-line">
            <span class="total-key">Скидка <span class="promo-code">{{ form.promoCode }}</span></span>
            <span class="total-val discount">−{{ form.discountAmount }} ₽</span>
          </div>
          <div class="total-line">
            <span class="total-key">Стоимость доставки</span>
            <UiInputNumber
              v-model="form.deliveryFee"
              :min="0"
              :disabled="!can.editDeliveryFee"
              class="fee-input"
            />
          </div>
          <div class="total-line total-final">
            <span class="total-key">Итого</span>
            <span class="total-val">{{ total }} ₽</span>
          </div>
        </section>

        <!-- Оплата -->
        <section class="section">
          <div class="section-label">Способ оплаты</div>
          <UiSelect
            v-model:value="form.paymentType"
            :options="paymentOptions"
            :disabled="!can.editPayment"
          />
        </section>

        <!-- Комментарий клиента -->
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
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UiModal, UiInput, UiInputNumber, UiSelect, UiSegmentedControl, UiTabs, UiButton, UiMenuDropdown, UiAlert, UiTag,
} from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { useOrderEdit } from '~/composables/useOrderEdit'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useStatusColor } from '~/composables/useStatusColor'
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '~/config/order-options'
import { useOrderEventLogger } from '~/composables/useOrderEventLogger'
import OrderItemsSection from './OrderItemsSection.vue'
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

const { update: updateOrder } = useOrderEdit()
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

const subtotal = computed(() => form.items.reduce((s, i) => s + i.price * i.quantity, 0),
)

const total = computed(() => subtotal.value - form.discountAmount + form.deliveryFee,
)

// ─── Save ─────────────────────────────────────────────────────────────────────

const onSave = async () => {
  if (!props.order) return false
  saving.value = true
  try {
    const updated = await updateOrder(props.order.id, {
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

// ─── Options ──────────────────────────────────────────────────────────────────

const deliveryItems = DELIVERY_OPTIONS
const paymentOptions = PAYMENT_OPTIONS

const modalActions = computed(() => {
  type ModalAction = { text: string; type: 'default' | 'primary'; actionType: 'decline' | 'confirm'; loading?: boolean }
  const actions: ModalAction[] = [{ text: 'Закрыть', type: 'default', actionType: 'decline' }]

  if (activeTab.value === 'data') {
    actions.push({ text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving.value })
  }

  return actions
})
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

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mt {
  margin-top: 2px;
}

.field-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.totals-section {
  background: var(--color-bg-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  gap: 8px;
}

.total-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.total-key {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.total-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
}

.discount {
  color: var(--green-500);
}

.promo-code {
  font-weight: 600;
  color: var(--color-title);
}

.fee-input {
  width: 90px;
}

.total-final {
  padding-top: 8px;
  margin-top: 2px;
  border-top: 1px solid var(--color-border-light);

  .total-key {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-title);
  }

  .total-val {
    font-size: 16px;
    font-weight: 800;
  }
}
</style>
