<template>
  <!-- Клиент -->
  <section class="section">
    <div class="section-label">Клиент</div>
    <div class="fields-row">
      <UiInput
        v-model="form.customerName"
        name="customerName"
        label="Имя"
        placeholder="Иван Иванов"
        :rules="[validationRules.name.required]"
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
  </section>

  <!-- Доставка -->
  <section class="section">
    <div class="section-label">Доставка</div>
    <div :class="{ 'field-disabled': !perms.editDeliveryType }">
      <UiSegmentedControl v-model="form.deliveryType" :items="deliveryItems" size="medium" />
    </div>
    <UiInput
      v-if="form.deliveryType === 'delivery'"
      v-model="form.address"
      name="address"
      label="Адрес"
      placeholder="ул. Пушкина, д. 10, кв. 5"
      :rules="[validationRules.address.required]"
      :disabled="!perms.editAddress"
      class="mt"
    />
  </section>

  <!-- Состав -->
  <OrderItemsSection
    :items="form.items"
    :tenant-id="tenantId"
    :readonly="!perms.editItems"
    @update:items="form.items = $event"
  />
  <div v-if="itemsError" class="items-error">{{ itemsError }}</div>

  <!-- Итого -->
  <section class="section totals-section">
    <div class="total-line">
      <span class="total-key">Сумма</span>
      <span class="total-val">{{ subtotal }} ₽</span>
    </div>
    <div v-if="(form.discountAmount ?? 0) > 0" class="total-line">
      <span class="total-key">Скидка <span class="promo-code">{{ form.promoCode }}</span></span>
      <span class="total-val discount">−{{ form.discountAmount }} ₽</span>
    </div>
    <div class="total-line">
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
  </section>

  <!-- Оплата -->
  <section class="section">
    <div class="section-label">Способ оплаты</div>
    <UiSelect
      v-model:value="form.paymentType"
      :options="paymentOptions"
      :disabled="!perms.editPayment"
    />
  </section>

  <!-- Комментарий (только в режиме создания) -->
  <section v-if="commentEditable" class="section">
    <div class="section-label">Комментарий</div>
    <UiInput v-model="form.comment" placeholder="Любые пожелания..." />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiInput, UiInputNumber, UiSelect, UiSegmentedControl, validationRules } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '~/config/order-options'
import OrderItemsSection from './OrderItemsSection.vue'

type OrderFormData = {
  customerName: string
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
}

const props = withDefaults(defineProps<{
  form: OrderFormData
  tenantId: string
  subtotal: number
  total: number
  permissions?: Permissions
  itemsError?: string
  commentEditable?: boolean
}>(), {
  permissions: () => ({}),
  itemsError: '',
  commentEditable: false,
})

const perms = computed(() => ({
  editCustomer: props.permissions.editCustomer ?? true,
  editDeliveryType: props.permissions.editDeliveryType ?? true,
  editAddress: props.permissions.editAddress ?? true,
  editItems: props.permissions.editItems ?? true,
  editDeliveryFee: props.permissions.editDeliveryFee ?? true,
  editPayment: props.permissions.editPayment ?? true,
}))

const deliveryItems = DELIVERY_OPTIONS
const paymentOptions = PAYMENT_OPTIONS
</script>

<style scoped lang="scss">
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

.items-error {
  font-size: 12px;
  color: var(--color-error);
  margin-top: -10px;
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
