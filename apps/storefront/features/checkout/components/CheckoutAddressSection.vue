<template>
  <section class="address-section">
    <FsHeading as="h6" class="section-title">Адрес доставки</FsHeading>

    <template v-if="authStore.isAuthenticated">
      <div v-if="addressesLoading" class="addr-skeleton" />

      <template v-else-if="savedAddresses.length">
        <!-- Список сохранённых + кнопка "Другой адрес" -->
        <div v-if="!useNewAddress" class="addr-list">
          <label v-for="addr in savedAddresses" :key="addr.id" class="addr-option">
            <input
              type="radio"
              name="checkout-address"
              :value="addr.id"
              :checked="selectedAddressId === addr.id"
              @change="selectSavedAddress(addr)"
            >
            <span class="addr-content">
              <span class="addr-main">{{ addr.label || addr.address }}</span>
              <span v-if="addr.label" class="addr-lbl">{{ addr.address }}</span>
            </span>
          </label>
          <button type="button" class="addr-new-btn" @click="switchToNew">
            + Другой адрес
          </button>
        </div>

        <!-- Ручной ввод при "Другой адрес" -->
        <div v-else class="addr-manual-wrap">
          <button type="button" class="addr-back-btn" @click="switchToSaved">
            ← Мои адреса
          </button>
          <AddressManualInput ref="manualInputRef" :currency="currency" @verified="onManualVerified" />
        </div>

        <!-- Статус доставки для сохранённого адреса -->
        <template v-if="showSavedAddressStatus">
          <FsAlert v-if="checkout.belowMinOrder" type="warning" :icon="AlertTriangle">
            Минимальная сумма заказа для доставки по данному адресу: <strong>{{ checkout.minOrderAmount }} {{ currency }}</strong> (без учёта доставки)
          </FsAlert>
          <template v-else-if="checkout.hasZones">
            <FsAlert v-if="zoneMatched" type="success" :icon="Check">
              Доставка:
              <strong v-if="zoneFee === 0">бесплатно</strong>
              <strong v-else>{{ zoneFee }} {{ currency }}</strong>
              <span v-if="checkout.deliveryZone!.freeDeliveryFrom && zoneFee > 0" class="zone-hint">
                (бесплатно от {{ checkout.deliveryZone!.freeDeliveryFrom }} {{ currency }})
              </span>
            </FsAlert>
            <FsAlert v-else-if="checkout.outsideZones" type="error" :icon="X">
              Адрес вне зоны доставки
            </FsAlert>
            <FsAlert v-else-if="addressCheckLoading" type="muted">
              Проверяем адрес...
            </FsAlert>
          </template>
          <FsAlert v-else-if="showFixedFee" type="success" :icon="Check">
            Доставка:
            <strong v-if="fixedFee === 0">бесплатно</strong>
            <strong v-else>{{ fixedFee }} {{ currency }}</strong>
            <span v-if="tenantFreeDeliveryFrom > 0 && fixedFee > 0" class="zone-hint">
              (бесплатно от {{ tenantFreeDeliveryFrom }} {{ currency }})
            </span>
          </FsAlert>
          <FsAlert v-if="branchClosedInfo && zoneMatched && !checkout.belowMinOrder" type="warning" :icon="Clock">
            Доставка по данному адресу доступна с {{ branchClosedInfo.time }} ({{ branchClosedInfo.day }})
          </FsAlert>
        </template>

        <p v-if="addressError" class="field-error">{{ addressError }}</p>
      </template>

      <!-- Нет сохранённых адресов -->
      <template v-else>
        <AddressManualInput ref="manualInputRef" :currency="currency" @verified="onManualVerified" />
      </template>
    </template>

    <!-- Гость -->
    <template v-else>
      <AddressManualInput ref="manualInputRef" :currency="currency" @verified="onManualVerified" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Check, X, Clock, AlertTriangle } from 'lucide-vue-next'
import type { CustomerAddress, Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { isOpenNow, DEFAULT_TIMEZONE } from '@fastio/shared'
import { useCheckoutStore } from '../stores/checkout'
import { useCartStore } from '~/features/cart'
import { useAuthStore } from '~/features/auth'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { useNuxtData } from 'nuxt/app'
import { FsHeading, FsAlert } from '@fastio/public-ui'
import AddressManualInput from './AddressManualInput.vue'

type Props = { currency: string }
defineProps<Props>()

const checkout = useCheckoutStore()
const cart = useCartStore()
const authStore = useAuthStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')
const tenantFreeDeliveryFrom = computed(() => tenant.value?.freeDeliveryFrom ?? 0)
const fixedFee = computed(() => checkout.deliveryFee)
const branchClosedInfo = ref<{ day: string; time: string } | null>(null)

const manualInputRef = ref<InstanceType<typeof AddressManualInput> | null>(null)
const savedAddresses = ref<CustomerAddress[]>([])
const addressesLoading = ref(false)
const selectedAddressId = ref<string | null>(null)
const addressCheckLoading = ref(false)
const addressTouched = ref(false)
const useNewAddress = ref(false)

const LAST_ADDRESS_KEY = 'lastCheckoutAddressId'

const zoneFee = computed(() => checkout.deliveryZone?.effectiveDeliveryFee ?? checkout.deliveryZone?.deliveryFee ?? 0)

// Юзер выбрал сохранённый адрес (не "Другой адрес")
const usingSavedAddress = computed(() => !useNewAddress.value && !!selectedAddressId.value)

// Можно показывать плашки статуса доставки для сохранённого адреса
const showSavedAddressStatus = computed(() => usingSavedAddress.value && !addressError.value)

// Зона определена, адрес внутри
const zoneMatched = computed(() => !!checkout.deliveryZone && !checkout.outsideZones)

// Фикс-режим, проверка завершена
const showFixedFee = computed(() =>
  !checkout.hasZones && !addressCheckLoading.value,
)

const addressError = computed(() => {
  if (!addressTouched.value) return ''
  if (!useNewAddress.value && savedAddresses.value.length && !selectedAddressId.value) {
    return 'Выберите адрес доставки'
  }
  return ''
})

async function fetchAddresses() {
  addressesLoading.value = true
  try {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    savedAddresses.value = await $fetch<CustomerAddress[]>('/api/customer/addresses', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    preselectAddress()
  } catch {
    savedAddresses.value = []
  } finally {
    addressesLoading.value = false
  }
}

function preselectAddress() {
  if (!savedAddresses.value.length) return
  const lastId = localStorage.getItem(LAST_ADDRESS_KEY)
  const found = lastId ? savedAddresses.value.find((a) => a.id === lastId) : null
  selectSavedAddress(found ?? savedAddresses.value[0])
}

async function selectSavedAddress(addr: CustomerAddress) {
  useNewAddress.value = false
  selectedAddressId.value = addr.id
  localStorage.setItem(LAST_ADDRESS_KEY, addr.id)
  checkout.form.address = addr.address
  checkout.form.addressCoords = addr.coordinates
    ? { lat: addr.coordinates.lat, lon: addr.coordinates.lng }
    : null
  checkout.deliveryZone = null
  checkout.outsideZones = false

  if (addr.coordinates) {
    await checkAddress(addr.coordinates.lat, addr.coordinates.lng)
  }
}

function switchToNew() {
  useNewAddress.value = true
  selectedAddressId.value = null
  checkout.form.address = ''
  checkout.form.addressCoords = null
  checkout.deliveryZone = null
  checkout.outsideZones = false
  branchClosedInfo.value = null
}

function switchToSaved() {
  useNewAddress.value = false
  preselectAddress()
}

function onManualVerified() {
  addressTouched.value = true
}

async function checkAddress(lat: number, lon: number) {
  if (tenant.value?.deliveryMode === 'fixed') {
    checkout.deliveryZone = null
    checkout.outsideZones = false
    checkout.hasZones = false
    branchClosedInfo.value = null
    return
  }

  addressCheckLoading.value = true
  try {
    const result = await $fetch<{
      zone: { id: string; branchId: string | null; deliveryFee: number; minOrder: number; freeDeliveryFrom: number | null; effectiveDeliveryFee?: number; branchSchedule?: WorkingHoursSchedule | null } | null
      outsideZones?: boolean
    }>('/api/check-address', { method: 'POST', body: { lat, lon, subtotal: cart.subtotal } })

    if (result.zone) {
      checkout.deliveryZone = result.zone
      checkout.outsideZones = false
      checkout.hasZones = true

      if (result.zone.branchSchedule) {
        const tz = tenant.value?.timezone ?? DEFAULT_TIMEZONE
        const status = isOpenNow(result.zone.branchSchedule, tz)
        branchClosedInfo.value = status.open ? null : status.nextChange
      } else {
        branchClosedInfo.value = null
      }
    } else if (result.outsideZones) {
      checkout.deliveryZone = null
      checkout.outsideZones = true
      checkout.hasZones = true
      branchClosedInfo.value = null
    } else {
      checkout.deliveryZone = null
      checkout.outsideZones = false
      checkout.hasZones = false
      branchClosedInfo.value = null
    }
  } catch {
    checkout.deliveryZone = null
    checkout.outsideZones = false
    branchClosedInfo.value = null
  } finally {
    addressCheckLoading.value = false
  }
}

let subtotalTimer: ReturnType<typeof setTimeout> | null = null
watch(() => cart.subtotal, () => {
  const coords = checkout.form.addressCoords
  if (!coords) return
  if (subtotalTimer) clearTimeout(subtotalTimer)
  subtotalTimer = setTimeout(() => checkAddress(coords.lat, coords.lon), 500)
})

watch(() => authStore.isAuthenticated, (val) => {
  if (val && !savedAddresses.value.length && !addressesLoading.value) fetchAddresses()
})

onMounted(() => {
  if (authStore.isAuthenticated) fetchAddresses()
})

defineExpose({
  isValid(): string | null {
    addressTouched.value = true
    if (authStore.isAuthenticated && savedAddresses.value.length) {
      if (useNewAddress.value) {
        if (!manualInputRef.value) return 'Введите адрес доставки'
        return manualInputRef.value.isValid()
      }
      if (!selectedAddressId.value) return 'Выберите адрес доставки'
      if (checkout.outsideZones) return 'Адрес вне зоны доставки'
      return null
    }
    if (!manualInputRef.value) return 'Введите адрес доставки'
    return manualInputRef.value.isValid()
  },
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.address-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  margin: 0 0 12px;
}

.addr-skeleton {
  height: 44px;
  border-radius: var(--radius-card);
  background: var(--color-border);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.addr-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.addr-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 6px;
  cursor: pointer;
  border-radius: 6px;
  user-select: none;

  &:hover { background: var(--color-surface); }

  input[type="radio"] {
    margin-top: 3px;
    flex-shrink: 0;
    accent-color: var(--primary);
    cursor: pointer;
  }
}

.addr-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.addr-main {
  @include text-caption;
  color: var(--color-text);
  line-height: 1.4;
}

.addr-lbl {
  @include text-micro;
  color: var(--color-text-secondary);
}

.addr-new-btn {
  display: inline-flex;
  align-items: center;
  padding: 7px 6px;
  @include text-xs;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  width: fit-content;

  &:hover { background: var(--color-surface); }
}

.addr-manual-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.addr-back-btn {
  display: inline-flex;
  align-items: center;
  @include text-xs;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  &:hover { color: var(--color-text); }
}

.zone-hint {
  opacity: 0.7;
  margin-left: 4px;
}

.field-error {
  @include text-xs;
  color: var(--color-error);
  margin: 4px 0 0;
}
</style>
