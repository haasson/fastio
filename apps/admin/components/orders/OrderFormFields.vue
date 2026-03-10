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
  </div>

  <!-- Доставка -->
  <div v-if="deliveryEnabled" class="block">
    <div class="block-label">Доставка</div>
    <div class="delivery-row">
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
      />
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
      <div v-if="deliveryEnabled" class="total-line">
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
import { computed } from 'vue'
import { UiInput, UiInputNumber, UiSelect, UiSegmentedControl, validationRules } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '~/config/order-options'
import { useTenantStore } from '~/stores/tenant'
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

const tenantStore = useTenantStore()
const deliveryEnabled = computed(() => tenantStore.tenant?.deliveryEnabled ?? true)

const deliveryItems = DELIVERY_OPTIONS
const paymentOptions = PAYMENT_OPTIONS
</script>

<style scoped lang="scss">
@use '@fastio/ui/src/styles/mixins/media-queries' as mq;

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

.delivery-row {
  display: flex;
  flex-direction: column;
  gap: 10px;

  @include mq.mq-m {
    flex-direction: row;
    align-items: flex-end;

    > :first-child {
      flex-shrink: 0;
    }

    > :last-child {
      flex: 1;
    }
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
</style>
