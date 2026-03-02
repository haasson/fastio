<template>
  <div class="page-root">
    <TheHeader v-if="tenant" :tenant="tenant" />

    <main class="main">
      <div class="container">
        <NuxtLink class="back-link" to="/">← Меню</NuxtLink>
        <h1 class="title">Корзина</h1>

        <div v-if="cartStore.items.length === 0" class="empty">
          <span class="empty-icon">🛒</span>
          <p>Корзина пуста</p>
          <NuxtLink class="btn-primary" to="/">Перейти в меню</NuxtLink>
        </div>

        <div v-else class="layout">
          <!-- Список позиций -->
          <section class="cart-items">
            <div v-for="(item, i) in cartStore.items" :key="i" class="cart-item">
              <div class="item-photo">
                <img v-if="item.photo" :src="item.photo" :alt="item.dishName" />
                <span v-else>🍽</span>
              </div>
              <div class="item-info">
                <span class="item-name">{{ item.dishName }}</span>
                <span v-if="item.removedIngredients.length" class="item-removed">
                  Без: {{ item.removedIngredients.join(', ') }}
                </span>
                <span class="item-price">{{ item.price }} ₽</span>
              </div>
              <div class="item-qty">
                <button class="qty-btn" @click="cartStore.decrement(i)">−</button>
                <span class="qty">{{ item.quantity }}</span>
                <button class="qty-btn" @click="cartStore.increment(i)">+</button>
              </div>
              <span class="item-total">{{ item.price * item.quantity }} ₽</span>
              <button class="remove-btn" @click="cartStore.remove(i)">✕</button>
            </div>

            <!-- Промокод -->
            <div class="promo-row">
              <input
                v-model="promoInput"
                class="input promo-input"
                type="text"
                placeholder="Промокод"
                :disabled="!!appliedPromo"
              />
              <button
                v-if="!appliedPromo"
                class="btn-outline"
                :disabled="!promoInput || promoLoading"
                @click="applyPromo"
              >
                {{ promoLoading ? '…' : 'Применить' }}
              </button>
              <button v-else class="btn-outline danger" @click="clearPromo">Убрать</button>
            </div>
            <p v-if="promoError" class="promo-error">{{ promoError }}</p>
            <p v-if="appliedPromo" class="promo-ok">
              ✅ Скидка {{ appliedPromo.discountType === 'percent'
                ? `${appliedPromo.discountValue}%`
                : `${appliedPromo.discountValue} ₽` }} применена
            </p>
          </section>

          <!-- Форма заказа -->
          <section class="order-form">
            <h2 class="form-title">Оформление заказа</h2>

            <form @submit.prevent="placeOrder">
              <!-- Доставка/самовывоз -->
              <div class="delivery-toggle">
                <button
                  type="button"
                  class="toggle-opt"
                  :class="{ active: form.deliveryType === 'delivery' }"
                  @click="form.deliveryType = 'delivery'"
                >
                  🚴 Доставка
                </button>
                <button
                  type="button"
                  class="toggle-opt"
                  :class="{ active: form.deliveryType === 'pickup' }"
                  @click="form.deliveryType = 'pickup'"
                >
                  🏃 Самовывоз
                </button>
              </div>

              <div class="field">
                <label class="label">Ваше имя *</label>
                <input v-model="form.name" class="input" type="text" required placeholder="Иван" />
              </div>

              <div class="field">
                <label class="label">Телефон *</label>
                <input v-model="form.phone" class="input" type="tel" required placeholder="+7 (999) 000-00-00" />
              </div>

              <div v-if="form.deliveryType === 'delivery'" class="field">
                <label class="label">Адрес доставки *</label>
                <input v-model="form.address" class="input" type="text" required placeholder="ул. Пушкина, д. 1, кв. 10" />
              </div>

              <!-- Оплата -->
              <div class="field">
                <label class="label">Способ оплаты</label>
                <div class="radio-group">
                  <label v-for="opt in paymentOptions" :key="opt.value" class="radio-opt">
                    <input v-model="form.paymentType" type="radio" :value="opt.value" />
                    {{ opt.label }}
                  </label>
                </div>
              </div>

              <div class="field">
                <label class="label">Комментарий</label>
                <textarea v-model="form.comment" class="input textarea" rows="2" placeholder="Пожелания к заказу..." />
              </div>

              <!-- Итого -->
              <div class="summary">
                <div class="summary-row">
                  <span>Товары</span>
                  <span>{{ cartStore.subtotal }} ₽</span>
                </div>
                <div v-if="form.deliveryType === 'delivery' && (tenant?.deliveryFee ?? 0) > 0" class="summary-row">
                  <span>Доставка</span>
                  <span>{{ tenant?.deliveryFee }} ₽</span>
                </div>
                <div v-if="discountAmount > 0" class="summary-row discount">
                  <span>Скидка</span>
                  <span>−{{ discountAmount }} ₽</span>
                </div>
                <div class="summary-total">
                  <span>Итого</span>
                  <span>{{ total }} ₽</span>
                </div>
              </div>

              <p v-if="minOrderError" class="order-error">{{ minOrderError }}</p>
              <p v-if="orderError" class="order-error">{{ orderError }}</p>

              <button type="submit" class="btn-primary submit-btn" :disabled="submitting || !!minOrderError">
                {{ submitting ? 'Оформляем…' : `Заказать на ${total} ₽` }}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()
const route = useRoute()
const rfetch = useRequestFetch()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
const { data: tenant } = await useAsyncData<Tenant>('tenant', () => rfetch('/api/tenant', slugQuery))

useHead({ title: 'Корзина' })

// Форма
const form = reactive({
  deliveryType: 'delivery' as 'delivery' | 'pickup',
  name: '',
  phone: '',
  address: '',
  paymentType: 'cash' as 'cash' | 'card' | 'online',
  comment: '',
})

const paymentOptions = [
  { value: 'cash', label: '💵 Наличные' },
  { value: 'card', label: '💳 Карта при получении' },
]

// Промокод
const promoInput = ref('')
const promoLoading = ref(false)
const promoError = ref('')
const appliedPromo = ref<{ code: string; discountType: 'percent' | 'fixed'; discountValue: number } | null>(null)

async function applyPromo() {
  promoError.value = ''
  promoLoading.value = true
  try {
    // TODO: проверка промокода через API
    promoError.value = 'Промокод не найден'
  } finally {
    promoLoading.value = false
  }
}

function clearPromo() {
  appliedPromo.value = null
  promoInput.value = ''
  promoError.value = ''
}

// Расчёт итога
const deliveryFee = computed(() =>
  form.deliveryType === 'delivery' ? (tenant.value?.deliveryFee ?? 0) : 0,
)


const discountAmount = computed(() => {
  if (!appliedPromo.value) return 0
  const { discountType, discountValue } = appliedPromo.value
  return discountType === 'percent'
    ? Math.round(cartStore.subtotal * discountValue / 100)
    : Math.min(discountValue, cartStore.subtotal)
})

const total = computed(() =>
  Math.max(0, cartStore.subtotal + deliveryFee.value - discountAmount.value),
)

const minOrderError = computed(() => {
  const min = tenant.value?.deliveryMinOrder ?? 0
  if (form.deliveryType === 'delivery' && min > 0 && cartStore.subtotal < min) {
    return `Минимальная сумма заказа: ${min} ₽`
  }
  return null
})

// Оформление
const submitting = ref(false)
const orderError = ref('')

async function placeOrder() {
  if (minOrderError.value) return
  orderError.value = ''
  submitting.value = true

  try {
    const { id } = await $fetch<{ id: string }>('/api/orders', {
      method: 'POST',
      body: {
        customer: { name: form.name, phone: form.phone },
        items: cartStore.items.map(({ photo: _, ...item }) => item),
        deliveryType: form.deliveryType,
        address: form.deliveryType === 'delivery' ? form.address : null,
        comment: form.comment || null,
        promoCode: appliedPromo.value?.code ?? null,
        discountAmount: discountAmount.value,
        subtotal: cartStore.subtotal,
        deliveryFee: deliveryFee.value,
        total: total.value,
        paymentType: form.paymentType,
      },
    })

    cartStore.clear()
    await navigateTo(`/order/${id}`)
  } catch (e: unknown) {
    orderError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Ошибка оформления заказа'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '../../../packages/ui/src/styles/mixins/media-queries' as *;

.page-root {
  min-height: 100vh;
  background: #f7f7f8;
}

.main {
  padding: 24px 0 60px;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

.back-link {
  font-size: 14px;
  color: #999;
  display: inline-block;
  margin-bottom: 12px;

  &:hover {
    color: #555;
  }
}

.title {
  font-size: 24px;
  font-weight: 800;
  color: #111;
  margin-bottom: 24px;
}

.empty {
  text-align: center;
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
}

.empty p {
  color: #999;
  font-size: 16px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;

  @include mq-m {
    grid-template-columns: 1fr 380px;
  }
}

.cart-items {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f5f5f5;

  &:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.item-photo {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: #f5f5f5;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: #111;
}

.item-removed {
  font-size: 11px;
  color: #bbb;
}

.item-price {
  font-size: 12px;
  color: #999;
}

.item-qty {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border: 1.5px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  transition: border-color 0.12s;

  &:hover {
    border-color: var(--primary);
  }
}

.qty {
  font-size: 14px;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

.item-total {
  font-size: 14px;
  font-weight: 700;
  color: #111;
  min-width: 60px;
  text-align: right;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  color: #ccc;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: #ffeaea;
    color: #e53935;
  }
}

.promo-row {
  display: flex;
  gap: 8px;
}

.promo-input {
  flex: 1;
}

.promo-error {
  font-size: 12px;
  color: #e53935;
}

.promo-ok {
  font-size: 12px;
  color: #10b981;
}

.order-form {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: static;

  @include mq-m {
    position: sticky;
    top: 20px;
  }
}

.form-title {
  font-size: 16px;
  font-weight: 700;
  color: #111;
}

.delivery-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f5f5f5;
  border-radius: 10px;
  padding: 3px;
}

.toggle-opt {
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #888;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &.active {
    background: #fff;
    color: #111;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.input {
  height: 42px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  background: #fff;

  &:focus {
    border-color: var(--primary);
  }
}

.textarea {
  height: auto;
  padding: 10px 12px;
  resize: none;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.summary {
  background: #f7f7f8;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #666;

  &.discount {
    color: #10b981;
  }
}

.summary-total {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 800;
  color: #111;
  padding-top: 6px;
  border-top: 1px solid #ebebeb;
  margin-top: 2px;
}

.order-error {
  font-size: 13px;
  color: #e53935;
}

.btn-primary {
  height: 48px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  width: 100%;

  &:hover:not(:disabled) {
    background: var(--primary-dark, #e55a25);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.submit-btn {
  margin-top: 4px;
}

.btn-outline {
  height: 42px;
  padding: 0 14px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  &.danger:hover {
    border-color: #e53935;
    color: #e53935;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
