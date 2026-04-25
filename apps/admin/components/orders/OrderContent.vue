<template>
  <div class="order-content-root">
    <UiCollapse :expanded-names="['data']">

      <UiCollapseItem name="data" title="Заказ">
        <UiForm ref="formRef" class="form">
          <div v-if="isEdit && statusMenuItems.length" class="status-row">
            <UiTag
              v-if="currentStatus"
              size="medium"
              round
              :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
            >{{ currentStatus.name }}</UiTag>
            <UiMenuDropdown
              :items="statusMenuItems"
              trigger="click"
              compact
              @item-click="onStatusSelect($event)"
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
            :items-error="itemsError"
            :comment-editable="!isEdit"
            :branch-options="branchOptions"
            :branch-id="selectedBranchId"
            :zones="activeZones"
            :delivery-info="deliveryInfo"
            :promo-options="promoOptions"
            :selected-promo-value="selectedPromoValue"
            :promo-error="promoError"
            :best-promo-hint="bestPromoHint"
            @promo-select="onPromoSelect"
            @update:branch-id="selectedBranchId = $event"
            @zone-detected="onZoneDetected"
          />

          <div v-if="isEdit && order?.comment" class="comment-block">
            <UiAlert size="small" type="info" icon="messageCircle">{{ order.comment }}</UiAlert>
          </div>
        </UiForm>
      </UiCollapseItem>

      <template v-if="isEdit">
        <UiCollapseItem
          v-if="customerOrders.length > 0"
          name="customer"
          :title="`История клиента · ${customerOrders.length}`"
        >
          <OrderCustomerHistory :orders="customerOrders" />
        </UiCollapseItem>

        <UiCollapseItem name="history" title="История">
          <OrderEventsSection
            :order-id="order!.id"
            :refresh-key="notesRefreshKey"
          />
        </UiCollapseItem>

        <UiCollapseItem name="notes" title="Заметки">
          <OrderNotesSection
            :order-id="order!.id"
            :tenant-id="tenantId"
            :refresh-key="notesRefreshKey"
          />
        </UiCollapseItem>
      </template>

    </UiCollapse>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UiCollapse, UiCollapseItem, UiForm, UiMenuDropdown, UiButton, UiAlert, UiTag,
} from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { getItemUnitPrice, formatPhone, normalizePhone, addDaysToDateStr, localDateTimeToUtcIso, utcIsoToLocalDateTime } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/composables/data/useDatabase'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useModules } from '~/composables/plan/useModules'
import { useOrderEventLogger } from '~/composables/data/useOrderEventLogger'
import { useOrderDelivery } from '~/composables/delivery/useOrderDelivery'
import { useOrderStatus } from '~/composables/data/useOrderStatus'
import { useOrderPromo } from '~/composables/data/useOrderPromo'
import { useOrderCustomerHistory } from '~/composables/data/useOrderCustomerHistory'
import OrderFormFields from './OrderFormFields.vue'
import OrderNotesSection from './OrderNotesSection.vue'
import OrderEventsSection from './OrderEventsSection.vue'
import OrderCustomerHistory from './OrderCustomerHistory.vue'

const props = defineProps<{
  tenantId: string
  order: Order | null
  branchId?: string | null
  tableId?: string | null
  tableName?: string | null
}>()

const emit = defineEmits<{
  saved: [order: Order]
}>()

const api = useDatabase()
const { logSaveEvents } = useOrderEventLogger()
const { statuses } = storeToRefs(useOrderStatusesStore())
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const modules = useModules()

const isEdit = computed(() => !!props.order)
const orderRef = computed(() => props.order)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))
const selectedBranchId = ref<string | null>(null)

const saving = ref(false)
const notesRefreshKey = ref(0)
const itemsError = ref('')
const formRef = ref<InstanceType<typeof UiForm> | null>(null)

// ─── Form ─────────────────────────────────────────────────────────────────────

const buildEditForm = (o: Order) => {
  let schedulingMode: 'asap' | 'scheduled' = 'asap'
  let scheduledDate: string | null = null
  let scheduledTime: string | null = null

  if (o.scheduledAt) {
    schedulingMode = 'scheduled'
    const { dateStr, timeStr } = utcIsoToLocalDateTime(o.scheduledAt, tenantStore.timezone)

    scheduledDate = dateStr
    scheduledTime = timeStr
  }

  return {
    status: o.status,
    customerName: o.customerName,
    customerPhone: formatPhone(o.customerPhone),
    deliveryType: o.deliveryType,
    address: o.address ?? '',
    entrance: o.entrance ?? null,
    floor: o.floor ?? null,
    apartment: o.apartment ?? null,
    intercom: o.intercom ?? null,
    items: o.items.map((i) => ({ ...i })),
    discountAmount: o.discountAmount,
    promoCode: o.promoCode ?? '',
    deliveryFee: o.deliveryFee,
    comment: o.comment ?? '',
    paymentType: o.paymentType,
    schedulingMode,
    scheduledDate,
    scheduledTime,
    kitchenLeadMinutes: o.kitchenLeadMinutes,
  }
}

const buildCreateForm = () => ({
  status: statuses.value.find((s) => s.groupType === 'new')?.id ?? statuses.value[0]?.id ?? '',
  customerName: '',
  customerPhone: '',
  deliveryType: (props.tableId ? 'dine_in' : modules.delivery.value.active ? 'delivery' : 'pickup') as Order['deliveryType'],
  address: '',
  entrance: null,
  floor: null,
  apartment: null,
  intercom: null,
  items: [] as Order['items'],
  discountAmount: 0,
  promoCode: '',
  deliveryFee: 0,
  comment: '',
  paymentType: 'cash' as Order['paymentType'],
  schedulingMode: 'asap' as 'asap' | 'scheduled',
  scheduledDate: null as string | null,
  scheduledTime: null as string | null,
  kitchenLeadMinutes: null as number | null,
})

const form = reactive(buildCreateForm())

watch(
  () => props.order,
  (order) => {
    if (order) {
      Object.assign(form, buildEditForm(order))
      selectedBranchId.value = order.branchId
      notesRefreshKey.value++
    } else {
      Object.assign(form, buildCreateForm())
      selectedBranchId.value = props.branchId ?? null
      itemsError.value = ''
    }
  },
  { immediate: true },
)

watch(() => form.items, (items) => {
  if (items.length) itemsError.value = ''
})

const subtotal = computed(() => form.items.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0))
const total = computed(() => subtotal.value - (form.discountAmount ?? 0) + form.deliveryFee)

// ─── Scheduled time ───────────────────────────────────────────────────────────

const scheduledAt = computed<string | null>(() => {
  if (form.schedulingMode !== 'scheduled' || !form.scheduledDate || !form.scheduledTime) return null
  // Overnight-слоты из getAvailableSlots кодируются суффиксом "+1" (например "02:30+1" = следующий день в 02:30)
  const isNextDay = form.scheduledTime.endsWith('+1')
  const timeStr = isNextDay ? form.scheduledTime.slice(0, -2) : form.scheduledTime
  const dateStr = isNextDay ? addDaysToDateStr(form.scheduledDate, 1) : form.scheduledDate

  return localDateTimeToUtcIso(dateStr, timeStr, tenantStore.timezone)
})

const { currentStatus, statusMenuItems, can, onStatusSelect } = useOrderStatus(orderRef, isEdit, form, scheduledAt)
const { promoOptions, selectedPromoValue, autoPromotionId, promoError, bestPromoHint, onPromoSelect } = useOrderPromo(props.tenantId, orderRef, isEdit, form, subtotal, scheduledAt)
const { customerOrders } = useOrderCustomerHistory(props.tenantId, orderRef)

// ─── Delivery zones ───────────────────────────────────────────────────────────

const canEditBranch = computed(() => can.value.editBranch ?? false)

const { activeZones, deliveryInfo, effectiveDeliveryFee, deliveryCoords, onZoneDetected, initFromOrder } = useOrderDelivery({
  form, subtotal, selectedBranchId, canEditBranch,
})

watch(effectiveDeliveryFee, (fee) => {
  if (fee !== null) form.deliveryFee = fee
})

watch(
  () => props.order,
  (order) => {
    if (order?.deliveryType === 'delivery') {
      initFromOrder(order.deliveryLat, order.deliveryLon)
    }
  },
  { immediate: true },
)

const formPayload = computed(() => ({
  customerName: form.customerName,
  customerPhone: normalizePhone(form.customerPhone),
  items: form.items,
  deliveryType: form.deliveryType,
  address: form.address || null,
  entrance: form.entrance || null,
  floor: form.floor || null,
  apartment: form.apartment || null,
  intercom: form.intercom || null,
  deliveryLat: deliveryCoords.value?.lat ?? null,
  deliveryLon: deliveryCoords.value?.lon ?? null,
  comment: form.comment || null,
  discountAmount: form.discountAmount,
  promoCode: form.promoCode || null,
  promotionId: autoPromotionId.value,
  subtotal: subtotal.value,
  deliveryFee: form.deliveryFee,
  total: total.value,
  status: form.status,
  paymentType: form.paymentType,
  branchId: selectedBranchId.value,
  scheduledAt: scheduledAt.value,
  kitchenLeadMinutes: form.schedulingMode === 'scheduled' ? (form.kitchenLeadMinutes ?? null) : null,
}))

// ─── Save ─────────────────────────────────────────────────────────────────────

const save = async (): Promise<boolean | void> => {
  const formValid = formRef.value?.validate() ?? true

  if (!isEdit.value) {
    const hasItems = form.items.length > 0

    if (!hasItems) itemsError.value = 'Добавьте хотя бы одно блюдо'
    if (!formValid || !hasItems) return false
  } else {
    if (!formValid) return false
  }

  saving.value = true
  try {
    if (isEdit.value && props.order) {
      const updated = await api.orders.update(props.order.id, formPayload.value)

      if (updated) {
        logSaveEvents(form, props.order, statuses.value)
        emit('saved', updated)
      }
    } else {
      const branchId = branchOptions.value.length > 1
        ? selectedBranchId.value
        : branchStore.branches[0]?.id ?? null

      const created = await api.orders.create({
        tenantId: props.tenantId,
        ...formPayload.value,
        branchId,
        tableId: props.tableId ?? null,
        tableName: props.tableName ?? null,
      })

      if (created) emit('saved', created)
    }
  } finally {
    saving.value = false
  }
}

defineExpose({ save, saving, isEdit })
</script>

<style scoped lang="scss">
.order-content-root {
  display: flex;
  flex-direction: column;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.comment-block {
  margin-top: var(--space-4);
}

</style>
