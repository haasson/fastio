<template>
  <UiDrawer
    :model-value="modelValue"
    title="Новый заказ"
    :width="860"
    :actions="drawerActions"
    :on-confirm="onSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="content">

      <OrderFormFields
        :form="form"
        :tenant-id="tenantId"
        :subtotal="subtotal"
        :total="total"
        :items-error="itemsError"
        comment-editable
      />
    </UiForm>

  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import OrderFormFields from './OrderFormFields.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  branchId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': [order: Order]
}>()

const api = useDatabase()
const { statuses } = useOrderStatusesStore()

const saving = ref(false)
const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const itemsError = ref('')

const drawerActions = computed(() => [
  { text: 'Закрыть', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Создать', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const form = reactive({
  status: '',
  customerName: '',
  customerPhone: '',
  deliveryType: 'delivery' as Order['deliveryType'],
  address: '',
  items: [] as Order['items'],
  deliveryFee: 0,
  comment: '',
  paymentType: 'cash' as Order['paymentType'],
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.status = statuses.find((s) => s.groupType === 'new')?.id ?? statuses[0]?.id ?? ''
    form.customerName = ''
    form.customerPhone = ''
    form.deliveryType = 'delivery'
    form.address = ''
    form.items = []
    form.deliveryFee = 0
    form.comment = ''
    form.paymentType = 'cash'
    itemsError.value = ''
  },
)

watch(() => form.items, (items) => {
  if (items.length) itemsError.value = ''
})

const subtotal = computed(() => form.items.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0))
const total = computed(() => subtotal.value + form.deliveryFee)

const onSave = async () => {
  const formValid = formRef.value?.validate() ?? true
  const hasItems = form.items.length > 0

  if (!hasItems) itemsError.value = 'Добавьте хотя бы одно блюдо'
  if (!formValid || !hasItems) return false

  saving.value = true
  try {
    const created = await api.orders.create({
      tenantId: props.tenantId,
      branchId: props.branchId,
      customer: { name: form.customerName, phone: form.customerPhone },
      items: form.items,
      deliveryType: form.deliveryType,
      address: form.address || null,
      comment: form.comment || null,
      promoCode: null,
      discountAmount: 0,
      subtotal: subtotal.value,
      deliveryFee: form.deliveryFee,
      total: total.value,
      status: form.status,
      paymentType: form.paymentType,
    })

    if (created) emit('created', created)
  } finally {
    saving.value = false
  }
}

</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
