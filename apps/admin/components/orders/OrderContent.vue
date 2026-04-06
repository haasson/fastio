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
            @update:branch-id="selectedBranchId = $event"
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
          <div class="customer-history">
            <div
              v-for="o in customerOrders"
              :key="o.id"
              class="history-row"
              @click="router.push(`/orders/${o.id}`)"
            >
              <span class="history-num">#{{ o.orderNumber }}</span>
              <UiTag
                v-if="getOrderStatus(o.status)"
                size="small"
                round
                :type="STATUS_GROUP_TAG_TYPES[getOrderStatus(o.status)!.groupType]"
              >{{ getOrderStatus(o.status)!.name }}</UiTag>
              <span class="history-items">{{ o.items.map((i) => i.dishName).join(', ') }}</span>
              <span class="history-total">{{ o.total }} ₽</span>
              <span class="history-date">{{ formatDate(o.createdAt) }}</span>
            </div>
          </div>
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
import { useRouter } from '#imports'
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
import { useTenantStore } from '~/stores/tenant'
import { useModules } from '~/composables/plan/useModules'
import { useStatusColor } from '~/composables/ui/useStatusColor'
import { useOrderEventLogger } from '~/composables/data/useOrderEventLogger'
import OrderFormFields from './OrderFormFields.vue'
import OrderNotesSection from './OrderNotesSection.vue'
import OrderEventsSection from './OrderEventsSection.vue'

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

const router = useRouter()
const api = useDatabase()
const { logSaveEvents } = useOrderEventLogger()
const { statuses } = storeToRefs(useOrderStatusesStore())
const branchStore = useBranchStore()
const tenantStore = useTenantStore()
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

const formPayload = computed(() => ({
  customerName: form.customerName,
  customerPhone: normalizePhone(form.customerPhone),
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

const getOrderStatus = getStatusById

const formatDate = (iso: string) => {
  const d = new Date(iso)

  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

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

.customer-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--color-bg-hover);
  }
}

.history-num {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-title);
  min-width: 40px;
}

.history-items {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  white-space: nowrap;
}

.history-date {
  font-size: 12px;
  color: var(--color-text-hint);
  white-space: nowrap;
}
</style>
