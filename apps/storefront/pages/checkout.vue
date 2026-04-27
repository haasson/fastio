<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Меню', to: '/' }, { label: 'Корзина', to: '/cart' }]" current="Оформление">

        <div class="checkout-layout">
          <div class="checkout-form">

            <!-- Customer data -->
            <section class="form-section">
              <FsHeading as="h6" class="section-title">Ваши данные</FsHeading>

              <!-- Авторизованный: имя и телефон как текст -->
              <template v-if="authStore.isAuthenticated">
                <div class="customer-info">
                  <div v-if="authStore.customerName" class="info-row">
                    <span class="info-label">Имя</span>
                    <span class="info-value">{{ authStore.customerName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Телефон</span>
                    <span class="info-value">{{ authStore.customerPhone || '—' }}</span>
                  </div>
                </div>
                <FsField label="Комментарий к заказу">
                  <FsTextarea v-model="checkout.form.comment" placeholder="Пожелания к заказу..." :rows="2" resize="none" />
                </FsField>
              </template>

              <!-- Гость: инпуты -->
              <div v-else class="fields-stack">
                <FsField label="Имя">
                  <FsInput v-model="checkout.form.customerName" placeholder="Иван" autocomplete="given-name" />
                </FsField>
                <FsField label="Телефон" required :error="phoneError">
                  <FsInput
                    v-model="checkout.form.customerPhone"
                    type="tel"
                    placeholder="+7 (999) 123-45-67"
                    autocomplete="tel"
                    mask="+7 (###) ###-##-##"
                    :error="!!phoneError"
                  />
                </FsField>
                <FsField label="Комментарий к заказу">
                  <FsTextarea v-model="checkout.form.comment" placeholder="Пожелания к заказу..." :rows="2" resize="none" />
                </FsField>
              </div>
            </section>

            <!-- Delivery type (only if both enabled) -->
            <section v-if="showDeliveryTabs" class="form-section">
              <div class="delivery-tabs">
                <button
                  type="button"
                  class="delivery-tab"
                  :class="{ active: checkout.form.deliveryType === 'delivery' }"
                  @click="setDeliveryType('delivery')"
                >
                  <Truck :size="16" /> Доставка
                </button>
                <button
                  type="button"
                  class="delivery-tab"
                  :class="{ active: checkout.form.deliveryType === 'pickup' }"
                  @click="setDeliveryType('pickup')"
                >
                  <PersonStanding :size="16" /> Самовывоз
                </button>
              </div>
            </section>

            <CheckoutPickupBranch
              v-if="checkout.form.deliveryType === 'pickup'"
              ref="pickupBranchRef"
            />

            <CheckoutAddressSection
              v-if="checkout.form.deliveryType === 'delivery' && tenant?.deliveryAvailable"
              ref="addressRef"
              :currency="currency"
            />

            <!-- Timing -->
            <section v-if="schedulingEnabled" class="form-section">
              <FsHeading as="h6" class="section-title">Время</FsHeading>
              <FsRadioGroup
                v-model="checkout.form.schedulingMode"
                :options="schedulingOptions"
                orientation="vertical"
              />
              <div v-if="checkout.form.schedulingMode === 'scheduled'" class="schedule-fields">
                <FsField label="Дата">
                  <FsSelect
                    v-model="checkout.form.scheduledDate"
                    :options="dateOptions"
                    placeholder="Выберите дату"
                    @update:model-value="checkout.form.scheduledTime = ''"
                  />
                </FsField>
                <FsField label="Время">
                  <FsSelect
                    v-model="checkout.form.scheduledTime"
                    :options="timeSlots"
                    placeholder="Выберите время"
                    :disabled="!checkout.form.scheduledDate"
                  />
                </FsField>
              </div>
            </section>

            <!-- Payment -->
            <section class="form-section">
              <FsHeading as="h6" class="section-title">Оплата</FsHeading>
              <FsRadioGroup v-model="checkout.form.paymentType" :options="paymentOptions" orientation="vertical" />
              <div v-if="checkout.form.paymentType === 'cash'" class="change-section">
                <FsCheckbox v-model="checkout.form.needsChange" label="Нужна сдача" />
                <div v-if="checkout.form.needsChange" class="change-input">
                  <FsInput
                    :model-value="checkout.form.changeFrom ?? undefined"
                    type="number"
                    :min="changeMin"
                    :step="500"
                    :error="changeError"
                    suffix="₽"
                    @update:model-value="checkout.form.changeFrom = Number($event) || null"
                  />
                  <span v-if="changeError" class="change-hint error">Сумма должна быть больше итога заказа</span>
                </div>
              </div>
            </section>

            <CheckoutPromoSection v-if="tenant?.modules?.promotions" />
          </div>

          <CheckoutSidebar
            :currency="currency"
            :errors="submitErrors"
            :loading="submitting"
            @submit="submitOrder"
          />
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useNuxtData, navigateTo } from 'nuxt/app'
import { Truck, PersonStanding } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { validationRules } from '@fastio/kit'
import { localDateTimeToUtcIso, isAsapAvailable, addDaysToDateStr, useSchedulingSlots, DEFAULT_TIMEZONE } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useCheckoutStore } from '~/stores/checkout'
import { useAuthStore } from '~/stores/auth'
import { useConfirm } from '~/composables/useConfirm'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useCurrency } from '~/composables/useCurrency'
import PageShell from '~/components/sections/PageShell.vue'
import { FsSection, FsHeading, FsInput, FsTextarea, FsField, FsRadioGroup, FsSelect, FsCheckbox } from '@fastio/public-ui'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import CheckoutAddressSection from '~/components/checkout/CheckoutAddressSection.vue'
import CheckoutPickupBranch from '~/components/checkout/CheckoutPickupBranch.vue'
import CheckoutPromoSection from '~/components/checkout/CheckoutPromoSection.vue'
import CheckoutSidebar from '~/components/checkout/CheckoutSidebar.vue'


const cart = useCartStore()
const checkout = useCheckoutStore()
const authStore = useAuthStore()
const { confirm } = useConfirm()
const { data: tenant } = useNuxtData<Tenant>('tenant')

const currency = useCurrency()

const showDeliveryTabs = computed(() => {
  return !!tenant.value?.deliveryAvailable && !!tenant.value?.modules?.pickup
})

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличными',
  card: 'Картой при получении',
  online: 'Онлайн',
}

const paymentOptions = computed(() =>
  (tenant.value?.paymentMethods ?? ['cash', 'card'])
    .map((m) => ({ value: m, label: PAYMENT_LABELS[m] ?? m })),
)

watch(
  () => tenant.value?.paymentMethods,
  (methods) => {
    if (methods && !methods.includes(checkout.form.paymentType)) {
      checkout.form.paymentType = methods[0] ?? 'cash'
    }
  },
  { immediate: true },
)

const changeMin = computed(() => Math.ceil((checkout.orderTotal + 1) / 500) * 500)

watch(
  () => checkout.form.needsChange,
  (needs) => {
    if (needs && !checkout.form.changeFrom) {
      checkout.form.changeFrom = Math.ceil((checkout.orderTotal + 1) / 500) * 500
    }
    if (!needs) checkout.form.changeFrom = null
  },
)

const changeError = computed(() =>
  checkout.form.needsChange &&
  checkout.form.paymentType === 'cash' &&
  (checkout.form.changeFrom === null || checkout.form.changeFrom <= checkout.orderTotal),
)

const schedulingEnabled = computed(() => tenant.value?.orderSchedulingConfig?.enabled ?? false)

const tenantTz = computed(() => tenant.value?.timezone ?? DEFAULT_TIMEZONE)

const asapAvailable = computed(() => {
  const cfg = tenant.value?.orderSchedulingConfig
  if (!cfg) return true
  return isAsapAvailable(tenant.value?.workingHoursSchedule, cfg.closeBufferMinutes, tenantTz.value)
})

const schedulingOptions = computed(() => [
  { value: 'asap', label: 'Как можно скорее', disabled: !asapAvailable.value },
  { value: 'scheduled', label: 'К определённому времени' },
])

const { dateOptions, timeSlots } = useSchedulingSlots(
  tenant,
  () => checkout.form.deliveryType,
  () => checkout.form.scheduledDate,
)

watch(asapAvailable, (available) => {
  if (!available && checkout.form.schedulingMode === 'asap') {
    checkout.form.schedulingMode = 'scheduled'
  }
}, { immediate: true })

function setDeliveryType(type: 'delivery' | 'pickup') {
  checkout.form.deliveryType = type
  if (type === 'pickup') {
    checkout.deliveryZone = null
    checkout.outsideZones = false
  }
}

// Phone validation
const phoneError = ref('')
watch(() => checkout.form.customerPhone, () => { phoneError.value = '' })

// Address validation
const addressRef = ref<InstanceType<typeof CheckoutAddressSection> | null>(null)
const pickupBranchRef = ref<InstanceType<typeof CheckoutPickupBranch> | null>(null)

function validate(): boolean {
  phoneError.value = ''
  submitErrors.value = []

  const errors: string[] = []

  if (!authStore.isAuthenticated) {
    const phoneDigits = checkout.form.customerPhone.replace(/\D/g, '')
    if (!phoneDigits) {
      phoneError.value = validationRules.phone.required.message
      errors.push(validationRules.phone.required.message)
    } else if (phoneDigits.length < 11) {
      phoneError.value = validationRules.phone.format.message
      errors.push(validationRules.phone.format.message)
    }
  }

  if (checkout.form.deliveryType === 'pickup') {
    const pickupError = pickupBranchRef.value?.validate()
    if (pickupError) errors.push(pickupError)
  }

  if (checkout.form.deliveryType === 'delivery') {
    const addressError = addressRef.value?.isValid()
    if (addressError) errors.push(addressError)
  }

  if (checkout.form.schedulingMode === 'scheduled') {
    if (!checkout.form.scheduledDate) errors.push('Выберите дату доставки')
    else if (!checkout.form.scheduledTime) errors.push('Выберите время доставки')
  }

  if (changeError.value) errors.push('Укажите корректную сумму для сдачи')

  if (errors.length) {
    submitErrors.value = errors
    return false
  }

  return true
}

// Submit
const submitting = ref(false)
const submitErrors = ref<string[]>([])
const idempotencyKey = ref('')

onMounted(async () => {
  if (!tenant.value?.orderingEnabled) {
    await navigateTo('/', { replace: true })
    return
  }

  checkout.prefillFromAuth()

  if (cart.items.length === 0) {
    await navigateTo('/cart')
    return
  }

  idempotencyKey.value = crypto.randomUUID()

  const hasDelivery = tenant.value?.deliveryAvailable
  const hasPickup = tenant.value?.modules?.pickup
  if (!hasDelivery && hasPickup) checkout.form.deliveryType = 'pickup'
  else if (hasDelivery && !hasPickup) checkout.form.deliveryType = 'delivery'
})

async function submitOrder() {
  if (!validate()) return
  if (cart.items.length === 0) return

  if (checkout.form.deliveryType === 'delivery' && checkout.outsideZones) {
    const ok = await confirm('Похоже, мы не доставляем заказы по вашему адресу.', {
      title: 'Адрес вне зоны доставки',
      confirmLabel: 'Всё равно оформить',
    })
    if (!ok) return
  }

  submitting.value = true
  submitErrors.value = []

  try {
    const body: Record<string, unknown> = {
      customer: {
        name: checkout.form.customerName || undefined,
        phone: checkout.form.customerPhone,
      },
      items: cart.items.map((item) => ({
        dishId: item.dishId,
        comboId: item.comboId,
        dishName: item.dishName,
        categoryName: item.categoryName,
        price: item.price,
        quantity: item.quantity,
        removedIngredients: item.removedIngredients ?? [],
        modifiers: item.modifiers ?? [],
        addons: item.addons ?? [],
      })),
      deliveryType: checkout.form.deliveryType,
      comment: checkout.form.comment || undefined,
      paymentType: checkout.form.paymentType,
      needsChange: checkout.form.paymentType === 'cash' ? checkout.form.needsChange : false,
      changeFrom: checkout.form.paymentType === 'cash' && checkout.form.needsChange ? checkout.form.changeFrom : null,
      idempotencyKey: idempotencyKey.value,
    }

    if (checkout.form.deliveryType === 'delivery') {
      body.address = checkout.form.address
      body.entrance = checkout.form.entrance || null
      body.floor = checkout.form.floor || null
      body.apartment = checkout.form.apartment || null
      body.intercom = checkout.form.intercom || null
      if (checkout.form.addressCoords) {
        body.geoLat = checkout.form.addressCoords.lat
        body.geoLon = checkout.form.addressCoords.lon
      }
    }

    if (checkout.form.deliveryType === 'pickup' && checkout.form.pickupBranchId) {
      body.branchId = checkout.form.pickupBranchId
    }

    if (checkout.promoResult?.valid && checkout.form.promoCode) {
      body.promoCode = checkout.form.promoCode.trim()
    }

    if (checkout.form.schedulingMode === 'scheduled' && checkout.form.scheduledDate && checkout.form.scheduledTime) {
      const rawTime = checkout.form.scheduledTime
      const isNextDay = rawTime.endsWith('+1')
      const timeStr = isNextDay ? rawTime.slice(0, -2) : rawTime
      const dateStr = isNextDay ? addDaysToDateStr(checkout.form.scheduledDate, 1) : checkout.form.scheduledDate
      body.scheduledAt = localDateTimeToUtcIso(dateStr, timeStr, tenantTz.value)
    }

    const headers: Record<string, string> = {}
    if (authStore.isAuthenticated) {
      const supabase = useSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        headers.Authorization = `Bearer ${session.access_token}`
      }
    }

    const result = await $fetch<{ id: string; orderNumber: string | null }>('/api/orders', { method: 'POST', body, headers })

    cart.clear()
    checkout.clearPromo()
    await navigateTo(`/order/${result.id}`)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    submitErrors.value = [fetchErr?.data?.message ?? 'Не удалось оформить заказ. Попробуйте ещё раз.']
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.checkout-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @include mdl {
    grid-template-columns: 1fr 380px;
    align-items: start;
  }
}

.checkout-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);

  &:first-child {
    padding-top: 0;
  }
}

.section-title {
  margin: 0 0 16px;
}

.change-section {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.change-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 200px;
}

.change-hint {
  font-size: 13px;
  color: var(--color-error);
}

.delivery-tabs {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.delivery-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  @include text-caption(500);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s, color 0.15s;

  &.active {
    background: var(--primary);
    color: var(--on-primary);
  }

  &:not(.active):hover {
    background: var(--color-surface);
    color: var(--color-text);
  }
}

.fields-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  gap: 8px;
  @include text-caption;
}

.info-label {
  color: var(--color-text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.info-value {
  color: var(--color-text);
  font-weight: 500;
}

</style>
