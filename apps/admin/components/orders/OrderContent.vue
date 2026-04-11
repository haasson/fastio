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
            :items-error="itemsError"
            :comment-editable="!isEdit"
            :branch-options="branchOptions"
            :branch-id="selectedBranchId"
            :zones="activeZones"
            :delivery-info="deliveryInfo"
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
import { getItemUnitPrice, formatPhone, normalizePhone } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/composables/data/useDatabase'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useBranchStore } from '~/stores/branch'
import { useModules } from '~/composables/plan/useModules'
import { useStatusColor } from '~/composables/ui/useStatusColor'
import { useOrderEventLogger } from '~/composables/data/useOrderEventLogger'
import { useOrderDelivery } from '~/composables/delivery/useOrderDelivery'
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
const branchStore = useBranchStore()
const modules = useModules()
const { getStatusColor } = useStatusColor()

const isEdit = computed(() => !!props.order)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))
const selectedBranchId = ref<string | null>(null)

const saving = ref(false)
const notesRefreshKey = ref(0)
const itemsError = ref('')
const formRef = ref<InstanceType<typeof UiForm> | null>(null)

// ─── Status ───────────────────────────────────────────────────────────────────

const getStatusById = (statusId: string) => statuses.value.find((s) => s.id === statusId) ?? null

const currentStatus = computed(() => getStatusById(form.status))
const statusGroup = computed(() => currentStatus.value?.groupType ?? 'new')

const statusMenuItems = computed(() => statuses.value
  .filter((s) => s.id !== form.status)
  .map((s) => ({
    name: s.id,
    label: s.name,
    color: getStatusColor(s.id),
  })),
)

// ─── Permissions ──────────────────────────────────────────────────────────────

const can = computed(() => {
  if (!isEdit.value) return {}

  const g = statusGroup.value

  return {
    editCustomer: g === 'new' || g === 'in_progress',
    editDeliveryType: g === 'new',
    editAddress: g === 'new',
    editItems: g === 'new',
    editDeliveryFee: g === 'new' || g === 'in_progress',
    editPayment: g === 'new' || g === 'in_progress',
    editBranch: g === 'new',
  }
})

// ─── Form ─────────────────────────────────────────────────────────────────────

const buildEditForm = (o: Order) => ({
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
})

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

// ─── Computed totals ──────────────────────────────────────────────────────────

const subtotal = computed(() => form.items.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0))
const total = computed(() => subtotal.value - (form.discountAmount ?? 0) + form.deliveryFee)

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
  subtotal: subtotal.value,
  deliveryFee: form.deliveryFee,
  total: total.value,
  status: form.status,
  paymentType: form.paymentType,
  branchId: selectedBranchId.value,
}))

// ─── Customer history ─────────────────────────────────────────────────────────

const customerOrders = ref<Order[]>([])

watch(
  () => props.order?.customerPhone,
  async (phone) => {
    if (!phone || !props.order) {
      customerOrders.value = []

      return
    }
    const { orders } = await api.orders.list(props.tenantId, null, { search: phone, pageSize: 20 })

    if (props.order?.customerPhone !== phone) return
    customerOrders.value = orders.filter((o) => o.id !== props.order!.id)
  },
  { immediate: true },
)

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
        promoCode: null,
        discountAmount: 0,
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
  gap: 12px;
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
