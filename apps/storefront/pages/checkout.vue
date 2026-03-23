<template>
  <PageShell>
    <FsSection>
      <StorePageLayout back-to="/cart" back-label="Корзина">
        <template #heading>Оформление</template>

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

            <CheckoutAddressSection
              v-if="checkout.form.deliveryType === 'delivery'"
              ref="addressRef"
              :currency="currency"
            />

            <!-- Payment -->
            <section class="form-section">
              <FsHeading as="h6" class="section-title">Оплата</FsHeading>
              <FsRadioGroup v-model="checkout.form.paymentType" :options="paymentOptions" orientation="vertical" />
            </section>

            <CheckoutPromoSection :currency="currency" />
          </div>

          <CheckoutSidebar
            :currency="currency"
            :error="submitError"
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
import { storeToRefs } from 'pinia'
import { useNuxtData, navigateTo } from 'nuxt/app'
import { Truck, PersonStanding } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { validationRules } from '@fastio/kit'
import { useCartStore } from '~/stores/cart'
import { useCheckoutStore } from '~/stores/checkout'
import { useAuthStore } from '~/stores/auth'
import { useConfirm } from '~/composables/useConfirm'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useCurrency } from '~/composables/useCurrency'
import PageShell from '~/components/sections/PageShell.vue'
import { FsSection, FsHeading, FsInput, FsTextarea, FsField, FsRadioGroup } from '@fastio/public-ui'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import CheckoutAddressSection from '~/components/checkout/CheckoutAddressSection.vue'
import CheckoutPromoSection from '~/components/checkout/CheckoutPromoSection.vue'
import CheckoutSidebar from '~/components/checkout/CheckoutSidebar.vue'


const cart = useCartStore()
const checkout = useCheckoutStore()
const authStore = useAuthStore()
const { confirm } = useConfirm()
const { data: tenant } = useNuxtData<Tenant>('tenant')

const currency = useCurrency()
const { deliveryFee, discountAmount, orderTotal } = storeToRefs(checkout)

const showDeliveryTabs = computed(() => {
  const m = tenant.value?.modules
  return !!m?.delivery && !!m?.pickup
})

const paymentOptions = [
  { value: 'card', label: 'Картой при получении' },
  { value: 'cash', label: 'Наличными' },
]

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

function validate(): boolean {
  phoneError.value = ''

  const phoneDigits = checkout.form.customerPhone.replace(/\D/g, '')
  if (!phoneDigits) { phoneError.value = validationRules.phone.required.message; return false }
  if (phoneDigits.length < 11) { phoneError.value = validationRules.phone.format.message; return false }

  if (checkout.form.deliveryType === 'delivery') {
    if (!addressRef.value?.isValid()) return false
  }

  return true
}

// Submit
const submitting = ref(false)
const submitError = ref('')
const idempotencyKey = ref('')

onMounted(async () => {
  checkout.prefillFromAuth()
  cart.restore()

  if (cart.items.length === 0) {
    await navigateTo('/cart')
    return
  }

  idempotencyKey.value = crypto.randomUUID()

  const m = tenant.value?.modules
  if (m && !m.delivery && m.pickup) checkout.form.deliveryType = 'pickup'
  else if (m && m.delivery && !m.pickup) checkout.form.deliveryType = 'delivery'
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
  submitError.value = ''

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
      idempotencyKey: idempotencyKey.value,
    }

    if (checkout.form.deliveryType === 'delivery') {
      const addrParts = [checkout.form.address]
      if (checkout.form.entrance) addrParts.push(`подъезд ${checkout.form.entrance}`)
      if (checkout.form.floor) addrParts.push(`этаж ${checkout.form.floor}`)
      if (checkout.form.apartment) addrParts.push(`кв. ${checkout.form.apartment}`)
      if (checkout.form.intercom) addrParts.push(`домофон ${checkout.form.intercom}`)
      body.address = addrParts.join(', ')
      if (checkout.form.addressCoords) {
        body.geoLat = checkout.form.addressCoords.lat
        body.geoLon = checkout.form.addressCoords.lon
      }
    }

    if (checkout.promoResult?.valid && checkout.form.promoCode) {
      body.promoCode = checkout.form.promoCode.trim()
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
    await navigateTo(`/order/${result.id}`)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    submitError.value = fetchErr?.data?.message ?? 'Не удалось оформить заказ. Попробуйте ещё раз.'
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

  @include md {
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
  font-size: 14px;
  font-weight: 500;
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

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
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
