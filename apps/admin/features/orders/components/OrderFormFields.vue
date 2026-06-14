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
        callable
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
    <div v-if="form.deliveryType === 'delivery'" class="address-details">
      <UiInput
        v-model="form.entrance"
        label="Подъезд"
        placeholder="1"
        :maxlength="10"
        :disabled="!perms.editAddress"
      />
      <UiInput
        v-model="form.floor"
        label="Этаж"
        placeholder="3"
        :maxlength="10"
        :disabled="!perms.editAddress"
      />
      <UiInput
        v-model="form.apartment"
        label="Квартира"
        placeholder="42"
        :maxlength="20"
        :disabled="!perms.editAddress"
      />
      <UiInput
        v-model="form.intercom"
        label="Домофон"
        placeholder="42К1234"
        :maxlength="20"
        :disabled="!perms.editAddress"
      />
    </div>
    <template v-if="form.deliveryType === 'delivery' && addressVerified && deliveryInfo">
      <UiAlert v-if="deliveryInfo.outsideZones" type="error" size="small">
        Адрес вне зоны доставки
      </UiAlert>
      <UiAlert v-else-if="deliveryInfo.belowMinOrder" type="warning" size="small">
        Минимальная сумма для этого адреса: {{ formatPrice(deliveryInfo.minOrderAmount) }}
      </UiAlert>
      <template v-else>
        <UiAlert type="success" size="small">
          Доставка: <strong>{{ deliveryInfo.effectiveFee === 0 ? 'бесплатно' : formatPrice(deliveryInfo.effectiveFee) }}</strong>
          <span v-if="deliveryInfo.amountUntilFree > 0" class="zone-hint">
            (бесплатно от {{ formatPrice(deliveryInfo.freeDeliveryFrom) }}, ещё {{ formatPrice(deliveryInfo.amountUntilFree) }})
          </span>
        </UiAlert>
        <UiAlert v-if="deliveryInfo.branchAutoSwitched" type="info" size="small">
          Адрес относится к филиалу «{{ deliveryInfo.zoneBranchName }}». Филиал был изменён
        </UiAlert>
        <UiAlert v-else-if="deliveryInfo.branchMismatch" type="warning" size="small">
          Адрес в зоне филиала «{{ deliveryInfo.zoneBranchName }}», текущий филиал: «{{ deliveryInfo.currentBranchName }}»
        </UiAlert>
      </template>
    </template>
  </div>

  <!-- Время -->
  <div v-if="form.deliveryType !== 'dine_in'" class="block">
    <div class="block-label">Время</div>
    <div :class="{ 'field-disabled': !perms.editScheduling }">
      <UiSegmentedControl v-model="form.schedulingMode" :items="schedulingItems" size="medium" />
    </div>
    <div v-if="form.schedulingMode === 'scheduled'" class="schedule-row">
      <UiSelect
        :value="form.scheduledDate"
        :options="dateOptions"
        label="Дата"
        placeholder="Выберите дату"
        :disabled="!perms.editScheduling"
        @update:value="onDateChange"
      />
      <UiSelect
        v-model:value="form.scheduledTime"
        :options="timeSlots"
        label="Время"
        placeholder="Выберите время"
        :disabled="!perms.editScheduling || !form.scheduledDate"
      />
    </div>
    <UiSlider
      v-if="form.schedulingMode === 'scheduled'"
      :model-value="form.kitchenLeadMinutes ?? 60"
      label="Запустить на кухню за"
      :min="15"
      :max="180"
      :step="15"
      :marks="LEAD_MARKS"
      :disabled="!perms.editScheduling"
      @update:model-value="form.kitchenLeadMinutes = $event"
    />
    <UiAlert
      v-if="form.schedulingMode === 'scheduled' && isOverdue"
      type="warning"
      size="small"
    >
      Указанное время уже прошло — заказ примется как обычный, сразу в работу
    </UiAlert>
  </div>

  <!-- Состав заказа -->
  <div class="block">
    <div class="block-label">Состав</div>
    <OrderItemsSection
      :items="form.items"
      :tenant-id="tenantId"
      :readonly="!perms.editItems"
      :allow-add="perms.addItems"
      @update:items="form.items = $event"
      @add-item="emit('addItem', $event)"
    />
    <div v-if="itemsError" class="items-error">{{ itemsError }}</div>

    <!-- Итого -->
    <div class="totals">
      <div class="total-line">
        <span class="total-key">Сумма</span>
        <span class="total-val">{{ formatPrice(subtotal) }}</span>
      </div>
      <div v-if="promoOptions.length" class="total-line">
        <span class="total-key">Скидка / акция</span>
        <div class="promo-right">
          <UiSelect
            :value="selectedPromoValue"
            :options="promoOptions"
            :message="promoError ?? undefined"
            filterable
            class="promo-select"
            @update:value="emit('promo-select', $event != null ? String($event) : null)"
          />
          <span v-if="(form.discountAmount ?? 0) > 0" class="total-val discount">−{{ formatPrice(form.discountAmount) }}</span>
        </div>
      </div>
      <div v-if="bestPromoHint" class="promo-hint">
        {{ bestPromoHint.text }} · <button type="button" class="promo-hint-apply" @click="emit('promo-select', bestPromoHint.value)">Применить</button>
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
        <span class="total-val">{{ formatPrice(total) }}</span>
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
    <div v-if="form.paymentType === 'cash' && form.needsChange" class="change-row">
      <span class="block-label">Сдача с</span>
      <span class="change-value">{{ formatPrice(form.changeFrom) }}</span>
    </div>
  </div>

  <!-- Комментарий (только в режиме создания) -->
  <div v-if="commentEditable" class="block">
    <div class="block-label">Комментарий</div>
    <UiInput v-model="form.comment" placeholder="Любые пожелания..." />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiInput, UiInputNumber, UiSelect, UiSegmentedControl, UiAlert, UiSlider } from '@fastio/ui'
import { validationRules } from '@fastio/kit'
import type { Order, DeliveryZone, OrderItem } from '@fastio/shared'
import type { DeliveryInfo } from '../composables/delivery/useOrderDelivery'
import { findDeliveryZone, useSchedulingSlots, formatPrice, isScheduledOverdue } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { useDadataSuggestions, type DadataSuggestion } from '~/shared/composables/delivery/useDadataSuggestions'
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '~/config/retail/order-options'
import OrderItemsSection from './OrderItemsSection.vue'

const LEAD_MARKS: Record<number, string> = { 15: '15м', 30: '30м', 45: '45м', 60: '1ч', 90: '1.5ч', 120: '2ч', 180: '3ч' }

type OrderFormData = {
  customerName: string | null
  customerPhone: string
  deliveryType: Order['deliveryType']
  address: string
  entrance: string | null
  floor: string | null
  apartment: string | null
  intercom: string | null
  items: Order['items']
  discountAmount?: number
  promoCode?: string
  deliveryFee: number
  comment: string
  paymentType: Order['paymentType']
  needsChange: boolean
  changeFrom: number | null
  schedulingMode: 'asap' | 'scheduled'
  scheduledDate: string | null
  scheduledTime: string | null
  kitchenLeadMinutes: number | null
}

type Permissions = {
  editCustomer?: boolean
  editDeliveryType?: boolean
  editAddress?: boolean
  editItems?: boolean
  addItems?: boolean
  editDeliveryFee?: boolean
  editPayment?: boolean
  editBranch?: boolean
  editScheduling?: boolean
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
  deliveryInfo?: DeliveryInfo | null
  promoOptions?: { label: string; value: string }[]
  selectedPromoValue?: string | null
  promoError?: string | null
  bestPromoHint?: { text: string; value: string } | null
  scheduledAt?: string | null
}>(), {
  permissions: () => ({}),
  itemsError: '',
  commentEditable: false,
  zones: () => [],
  branchOptions: () => [],
  branchId: null,
  deliveryInfo: null,
  promoOptions: () => [],
  selectedPromoValue: null,
  promoError: null,
  bestPromoHint: null,
  scheduledAt: null,
})

const emit = defineEmits<{
  'zone-detected': [zone: DeliveryZone | null, outsideZones: boolean, coords: [number, number] | null]
  'update:branchId': [value: string | null]
  'promo-select': [value: string | null]
  'addItem': [item: OrderItem]
}>()

const selectedBranchId = computed({
  get: () => props.branchId,
  set: (val) => emit('update:branchId', val),
})

// ─── DaData address suggestions ─────────────────────────────────────────────

const { suggestions: dadataSuggestions, search: searchDadata, clear: clearDadata, showSuggestions, hideSuggestionsDelayed } = useDadataSuggestions()
const addressVerified = ref(!!props.form.address)

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
      validator: () => !props.deliveryInfo?.outsideZones,
      message: 'Адрес вне зоны доставки',
    })
  }

  return rules
})

const onAddressInput = () => {
  showSuggestions.value = true
  addressVerified.value = false
  searchDadata(props.form.address ?? '')
}

const pickSuggestion = (s: DadataSuggestion) => {
  props.form.address = s.value
  showSuggestions.value = false
  addressVerified.value = true
  clearDadata()

  if (s.data.geo_lat && s.data.geo_lon) {
    const point: [number, number] = [parseFloat(s.data.geo_lon), parseFloat(s.data.geo_lat)]

    if (props.zones.length === 0) {
      // fixed-режим: зон нет, но нужно пометить адрес как проверенный
      emit('zone-detected', null, false, point)
    } else {
      const zone = findDeliveryZone(point, props.zones)

      emit('zone-detected', zone, !zone, point)
    }
  }
}

const perms = computed(() => ({
  editCustomer: props.permissions.editCustomer ?? true,
  editDeliveryType: props.permissions.editDeliveryType ?? true,
  editAddress: props.permissions.editAddress ?? true,
  editItems: props.permissions.editItems ?? true,
  addItems: props.permissions.addItems ?? false,
  editDeliveryFee: props.permissions.editDeliveryFee ?? true,
  editPayment: props.permissions.editPayment ?? true,
  editBranch: props.permissions.editBranch ?? true,
  editScheduling: props.permissions.editScheduling ?? true,
}))

const schedulingItems = [
  { label: 'Как можно скорее', value: 'asap' },
  { label: 'К определённому времени', value: 'scheduled' },
]

const tenantStore = useTenantStore()
const { dateOptions, timeSlots } = useSchedulingSlots(
  () => tenantStore.tenant,
  () => props.form.deliveryType,
  () => props.form.scheduledDate,
)

const onDateChange = (date: string | number | (string | number)[] | null) => {
  props.form.scheduledDate = date as string | null
  props.form.scheduledTime = null
}

watch(() => props.form.schedulingMode, (mode) => {
  if (mode !== 'scheduled') return
  if (!props.form.scheduledDate) {
    const first = dateOptions.value.find((d) => !d.disabled)

    if (first) props.form.scheduledDate = first.value
  }
  if (!props.form.scheduledTime) {
    props.form.scheduledTime = timeSlots.value[0]?.value ?? null
  }
})

const gate = useGate()
const deliveryEnabled = computed(() => gate.delivery.value.enabled)
const isDeliveryOrder = computed(() => props.form.deliveryType === 'delivery')
// Показываем блок если: доставка включена, или заказ уже с доставкой, или есть выбор филиала (для самовывоза)
const showDeliveryBlock = computed(() => deliveryEnabled.value || isDeliveryOrder.value || props.branchOptions.length > 1)

const deliveryItems = DELIVERY_OPTIONS
const paymentOptions = PAYMENT_OPTIONS

const isOverdue = computed(() => isScheduledOverdue(props.scheduledAt))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.block {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-8);
  padding: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.block-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.delivery-first-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);

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
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin-top: calc(-1 * var(--space-4));
}

.totals {
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
  padding: var(--space-8) var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.total-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.total-key {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.total-val {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.discount {
  color: var(--green-500);
}

.promo-code {
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.promo-right {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.promo-select {
  width: 260px;
}

.promo-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-align: right;
}

.promo-hint-apply {
  all: unset;
  cursor: pointer;
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);

  &:hover {
    text-decoration: underline;
  }
}

.fee-input {
  width: 90px;
}

.total-final {
  padding-top: var(--space-8);
  margin-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);

  .total-key {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    color: var(--color-title);
  }

  .total-val {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }
}

.payment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-top: var(--space-4);
}

.payment-select {
  width: 260px;
}

.change-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-top: var(--space-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.change-value {
  font-weight: 500;
  color: var(--color-text);
}

.address-field {
  position: relative;
}

.address-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-8);

  @include mq.mq-m {
    grid-template-columns: repeat(4, 1fr);
  }
}

.zone-hint {
  opacity: 0.7;
  margin-left: var(--space-4);
}

.schedule-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  margin-top: var(--space-4);
  overflow: hidden;
}

.suggestion-item {
  display: block;
  width: 100%;
  padding: var(--space-8) var(--space-12);
  border: none;
  background: none;
  text-align: left;
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.1s;

  &:hover { background: var(--color-bg-hover); }

  & + & { border-top: 1px solid var(--color-border-light); }
}
</style>
