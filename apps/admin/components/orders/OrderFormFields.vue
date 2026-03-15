<template>
  <!-- Клиент -->
  <div class="block">
    <div class="block-label">Клиент</div>
    <div class="fields-row">
      <UiInput
        v-model="form.customerName"
        name="customerName"
        label="Имя"
        placeholder="Иван Иванов"
        :rules="[]"
        :disabled="!perms.editCustomer"
      />
      <UiInput
        v-model="form.customerPhone"
        name="customerPhone"
        label="Телефон"
        placeholder="+7 999 000 00 00"
        :rules="[validationRules.phone.required, validationRules.phone.format]"
        :disabled="!perms.editCustomer"
      />
    </div>
  </div>

  <!-- Доставка -->
  <div v-if="showDeliveryBlock" class="block">
    <div class="block-label">Доставка</div>
    <UiAlert v-if="!deliveryEnabled && isDeliveryOrder" type="warning" size="small">
      Доставка сейчас отключена, но данный заказ был принят до отключения доставки
    </UiAlert>
    <div class="delivery-first-row">
      <div v-if="deliveryEnabled || isDeliveryOrder" :class="{ 'field-disabled': !perms.editDeliveryType }">
        <UiSegmentedControl v-model="form.deliveryType" :items="deliveryItems" size="medium" />
      </div>
      <UiSelect
        v-if="branchOptions.length > 1"
        v-model:value="selectedBranchId"
        :options="branchOptions"
        label="Филиал"
        placeholder="Выберите филиал"
        name="branchId"
        :rules="[{ type: 'required', message: 'Выберите филиал' }]"
        :disabled="!perms.editBranch"
        class="branch-select"
      />
    </div>
    <div v-if="form.deliveryType === 'delivery'" class="address-field">
      <UiInput
        v-model="form.address"
        name="address"
        label="Адрес"
        placeholder="ул. Пушкина, д. 10, кв. 5"
        :rules="addressRules"
        :disabled="!perms.editAddress"
        @input="onAddressInput"
        @focus="showSuggestions = true"
        @blur="hideSuggestionsDelayed"
      />
      <div v-if="showSuggestions && dadataSuggestions.length" class="suggestions-dropdown">
        <button
          v-for="(s, i) in dadataSuggestions"
          :key="i"
          class="suggestion-item"
          @mousedown.prevent="pickSuggestion(s)"
        >
          {{ s.value }}
        </button>
      </div>
    </div>
  </div>

  <!-- Состав заказа -->
  <div class="block">
    <div class="block-label">Состав</div>
    <OrderItemsSection
      :items="form.items"
      :tenant-id="tenantId"
      :readonly="!perms.editItems"
      @update:items="form.items = $event"
    />
    <div v-if="itemsError" class="items-error">{{ itemsError }}</div>

    <!-- Итого -->
    <div class="totals">
      <div class="total-line">
        <span class="total-key">Сумма</span>
        <span class="total-val">{{ subtotal }} ₽</span>
      </div>
      <div v-if="(form.discountAmount ?? 0) > 0" class="total-line">
        <span class="total-key">Скидка <span class="promo-code">{{ form.promoCode }}</span></span>
        <span class="total-val discount">−{{ form.discountAmount }} ₽</span>
      </div>
      <div v-if="deliveryEnabled || isDeliveryOrder" class="total-line">
        <span class="total-key">Стоимость доставки</span>
        <UiInputNumber
          v-model="form.deliveryFee"
          :min="0"
          :disabled="!perms.editDeliveryFee"
          class="fee-input"
        />
      </div>
      <div class="total-line total-final">
        <span class="total-key">Итого</span>
        <span class="total-val">{{ total }} ₽</span>
      </div>
    </div>

    <!-- Оплата -->
    <div class="payment-row">
      <span class="block-label">Способ оплаты</span>
      <UiSelect
        v-model:value="form.paymentType"
        :options="paymentOptions"
        :disabled="!perms.editPayment"
        class="payment-select"
      />
    </div>
  </div>

  <!-- Комментарий (только в режиме создания) -->
  <div v-if="commentEditable" class="block">
    <div class="block-label">Комментарий</div>
    <UiInput v-model="form.comment" placeholder="Любые пожелания..." />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiInput, UiInputNumber, UiSelect, UiSegmentedControl, UiAlert } from '@fastio/ui'
import { validationRules } from '@fastio/kit'
import type { Order, DeliveryZone } from '@fastio/shared'
import { findDeliveryZone } from '@fastio/shared'
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '~/config/order-options'
import { useTenantStore } from '~/stores/tenant'
import { useDadataSuggestions, type DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'
import OrderItemsSection from './OrderItemsSection.vue'

type OrderFormData = {
  customerName: string | null
  customerPhone: string
  deliveryType: Order['deliveryType']
  address: string
  items: Order['items']
  discountAmount?: number
  promoCode?: string
  deliveryFee: number
  comment: string
  paymentType: Order['paymentType']
}

type Permissions = {
  editCustomer?: boolean
  editDeliveryType?: boolean
  editAddress?: boolean
  editItems?: boolean
  editDeliveryFee?: boolean
  editPayment?: boolean
  editBranch?: boolean
}

type BranchOption = { label: string; value: string }

const props = withDefaults(defineProps<{
  form: OrderFormData
  tenantId: string
  subtotal: number
  total: number
  permissions?: Permissions
  itemsError?: string
  commentEditable?: boolean
  zones?: DeliveryZone[]
  branchOptions?: BranchOption[]
  branchId?: string | null
}>(), {
  permissions: () => ({}),
  itemsError: '',
  commentEditable: false,
  zones: () => [],
  branchOptions: () => [],
  branchId: null,
})

const emit = defineEmits<{
  'zone-detected': [zone: DeliveryZone | null]
  'update:branchId': [value: string | null]
}>()

const selectedBranchId = computed({
  get: () => props.branchId,
  set: (val) => emit('update:branchId', val),
})

// ─── DaData address suggestions ─────────────────────────────────────────────

const { suggestions: dadataSuggestions, search: searchDadata, clear: clearDadata, showSuggestions, hideSuggestionsDelayed } = useDadataSuggestions()
const addressVerified = ref(false)
const detectedZone = ref<DeliveryZone | null>(null)

const addressRules = computed(() => {
  const rules = [validationRules.address.required]

  if (props.zones.length > 0) {
    rules.push({
      type: 'custom' as const,
      validator: () => addressVerified.value,
      message: 'Выберите адрес из подсказок',
    })
    rules.push({
      type: 'custom' as const,
      validator: () => !addressVerified.value || detectedZone.value !== null,
      message: 'Адрес вне зоны доставки',
    })
  }

  return rules
})

const onAddressInput = () => {
  showSuggestions.value = true
  addressVerified.value = false
  detectedZone.value = null
  searchDadata(props.form.address ?? '')
}

const pickSuggestion = (s: DadataSuggestion) => {
  props.form.address = s.value
  showSuggestions.value = false
  addressVerified.value = true
  clearDadata()

  if (s.data.geo_lat && s.data.geo_lon) {
    const point: [number, number] = [parseFloat(s.data.geo_lon), parseFloat(s.data.geo_lat)]
    const zone = findDeliveryZone(point, props.zones)

    detectedZone.value = zone
    emit('zone-detected', zone)
  }
}

const perms = computed(() => ({
  editCustomer: props.permissions.editCustomer ?? true,
  editDeliveryType: props.permissions.editDeliveryType ?? true,
  editAddress: props.permissions.editAddress ?? true,
  editItems: props.permissions.editItems ?? true,
  editDeliveryFee: props.permissions.editDeliveryFee ?? true,
  editPayment: props.permissions.editPayment ?? true,
  editBranch: props.permissions.editBranch ?? true,
}))

const tenantStore = useTenantStore()
const deliveryEnabled = computed(() => tenantStore.tenant?.deliveryEnabled ?? true)
const isDeliveryOrder = computed(() => props.form.deliveryType === 'delivery')
// Показываем блок если: доставка включена, или заказ уже с доставкой, или есть выбор филиала (для самовывоза)
const showDeliveryBlock = computed(() => deliveryEnabled.value || isDeliveryOrder.value || props.branchOptions.length > 1)

const deliveryItems = DELIVERY_OPTIONS
const paymentOptions = PAYMENT_OPTIONS
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.block {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.delivery-first-row {
  display: flex;
  flex-direction: column;
  gap: 10px;

  @include mq.mq-m {
    flex-direction: row;
    align-items: flex-end;
  }
}

.branch-select {
  width: 100%;

  @include mq.mq-m {
    width: 200px;
    flex-shrink: 0;
  }
}

.field-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.items-error {
  font-size: 12px;
  color: var(--color-error);
  margin-top: -4px;
}

.totals {
  background: var(--color-bg-subtle);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
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

.payment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 4px;
}

.payment-select {
  width: 180px;
}

.address-field {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  margin-top: 4px;
  overflow: hidden;
}

.suggestion-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.1s;

  &:hover { background: var(--color-bg-hover); }

  & + & { border-top: 1px solid var(--color-border-light); }
}
</style>
