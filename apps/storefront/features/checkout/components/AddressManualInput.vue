<template>
  <div class="address-field-wrap">
    <div class="address-input-wrap">
      <FsInput
        :model-value="checkout.form.address"
        placeholder="Начните вводить адрес..."
        :error="!!addressError"
        @update:model-value="onAddressInput"
        @focus="showSuggestions = true"
        @blur="hideSuggestionsDelayed(); addressTouched = true"
      />

      <FsDropdownList
        v-if="showSuggestions"
        :items="suggestionItems"
        @select="onSuggestionSelect"
      />
    </div>

    <p v-if="addressError" class="field-error">{{ addressError }}</p>

    <!-- Детали адреса после выбора из Dadata -->
    <div v-if="addressVerified" class="addr-details">
      <div class="details-row">
        <FsField label="Подъезд">
          <FsInput v-model="checkout.form.entrance" placeholder="1" />
        </FsField>
        <FsField label="Этаж">
          <FsInput v-model="checkout.form.floor" placeholder="3" />
        </FsField>
      </div>
      <div class="details-row">
        <FsField label="Квартира">
          <FsInput v-model="checkout.form.apartment" placeholder="15" />
        </FsField>
        <FsField label="Домофон">
          <FsInput v-model="checkout.form.intercom" placeholder="15К123" />
        </FsField>
      </div>
    </div>

    <template v-if="!addressError">
      <FsAlert v-if="checkout.belowMinOrder" type="warning" :icon="AlertTriangle">
        Минимальная сумма заказа для доставки по данному адресу: <strong>{{ formatPrice(checkout.minOrderAmount) }}</strong> (без учёта доставки)
      </FsAlert>
      <FsAlert v-else-if="checkout.deliveryZone && !checkout.outsideZones" type="success" :icon="Check">
        Доставка:
        <strong v-if="zoneFee === 0">бесплатно</strong>
        <strong v-else>{{ formatPrice(zoneFee) }}</strong>
        <span v-if="checkout.deliveryZone.freeDeliveryFrom && zoneFee > 0" class="zone-hint">
          (бесплатно от {{ formatPrice(checkout.deliveryZone.freeDeliveryFrom) }})
        </span>
      </FsAlert>
      <FsAlert v-else-if="checkout.outsideZones" type="error" :icon="X">
        Адрес вне зоны доставки
      </FsAlert>
      <FsAlert v-else-if="addressCheckLoading" type="muted">
        Проверяем адрес...
      </FsAlert>
      <FsAlert v-else-if="addressVerified && !checkout.hasZones" type="success" :icon="Check">
        Доставка:
        <strong v-if="fixedFee === 0">бесплатно</strong>
        <strong v-else>{{ formatPrice(fixedFee) }}</strong>
        <span v-if="tenantFreeDeliveryFrom > 0 && fixedFee > 0" class="zone-hint">
          (бесплатно от {{ formatPrice(tenantFreeDeliveryFrom) }})
        </span>
      </FsAlert>
    </template>
    <FsAlert v-if="addressError && !checkout.hasZones && checkout.belowMinOrder" type="warning" :icon="AlertTriangle">
      Минимальная сумма заказа для доставки: <strong>{{ formatPrice(checkout.minOrderAmount) }}</strong> (без учёта доставки)
    </FsAlert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { Check, AlertTriangle, X } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useCheckoutStore } from '../stores/checkout'
import { useCartStore } from '~/features/cart'
import type { DadataSuggestion } from '~/shared/composables/useDadataSuggestions'
import { useDadataSuggestions } from '~/shared/composables/useDadataSuggestions'
import { FsInput, FsAlert, FsDropdownList, FsField } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import { reportError } from '~/shared/utils/reportError'

const emit = defineEmits<{ verified: [] }>()

const checkout = useCheckoutStore()
const cart = useCartStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')
const tenantFreeDeliveryFrom = computed(() => tenant.value?.freeDeliveryFrom ?? 0)
const fixedFee = computed(() => checkout.deliveryFee)
const { suggestions, search, showSuggestions, hideSuggestionsDelayed, clear: clearSuggestions } = useDadataSuggestions()

const addressVerified = ref(false)
const addressTouched = ref(false)
const addressCheckLoading = ref(false)

const zoneFee = computed(() => checkout.deliveryZone?.effectiveDeliveryFee ?? checkout.deliveryZone?.deliveryFee ?? 0)

const suggestionItems = computed(() =>
  suggestions.value.map((s) => ({ value: s.value, label: s.value, _raw: s })),
)

const addressError = computed(() => {
  if (!addressTouched.value) return ''
  if (!checkout.form.address.trim()) return validationRules.address.required.message
  if (!addressVerified.value) return 'Выберите адрес из списка'
  return ''
})

function onAddressInput(value: string | number) {
  const str = String(value)
  checkout.form.address = str
  checkout.form.addressCoords = null
  checkout.deliveryZone = null
  checkout.outsideZones = false
  addressVerified.value = false
  search(str)
  showSuggestions.value = true
}

function onSuggestionSelect(item: { value: string; [key: string]: unknown }) {
  selectAddress((item as unknown as { _raw: DadataSuggestion })._raw)
}

async function selectAddress(suggestion: DadataSuggestion) {
  checkout.form.address = suggestion.value
  showSuggestions.value = false
  clearSuggestions()
  addressVerified.value = true
  addressTouched.value = true
  emit('verified')

  const lat = parseFloat(suggestion.data.geo_lat ?? '')
  const lon = parseFloat(suggestion.data.geo_lon ?? '')
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    checkout.form.addressCoords = { lat, lon }
    await checkAddress(lat, lon)
  }
}

async function checkAddress(lat: number, lon: number) {
  if (tenant.value?.deliveryMode === 'fixed') {
    checkout.deliveryZone = null
    checkout.outsideZones = false
    checkout.hasZones = false
    return
  }

  addressCheckLoading.value = true
  try {
    const result = await $fetch<{
      zone: { id: string; branchId: string | null; deliveryFee: number; minOrder: number; freeDeliveryFrom: number | null; effectiveDeliveryFee?: number } | null
      outsideZones?: boolean
    }>('/api/check-address', { method: 'POST', body: { lat, lon, subtotal: cart.subtotal } })

    if (result.zone) {
      checkout.deliveryZone = result.zone
      checkout.outsideZones = false
      checkout.hasZones = true
    } else if (result.outsideZones) {
      checkout.deliveryZone = null
      checkout.outsideZones = true
      checkout.hasZones = true
    } else {
      checkout.deliveryZone = null
      checkout.outsideZones = false
      checkout.hasZones = false
    }
  } catch (e) {
    reportError(e, { context: 'AddressManualInput:checkAddress', lat, lon })
    checkout.deliveryZone = null
    checkout.outsideZones = false
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

watch(() => checkout.form.addressCoords, (coords) => {
  if (coords) addressVerified.value = true
}, { immediate: true })

onMounted(() => {
  const coords = checkout.form.addressCoords
  if (coords) checkAddress(coords.lat, coords.lon)
})

defineExpose({
  isValid(): string | null {
    addressTouched.value = true
    if (addressError.value) return addressError.value
    if (checkout.outsideZones) return 'Адрес вне зоны доставки'
    return null
  },
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.address-field-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.address-input-wrap {
  position: relative;
}

.zone-hint {
  opacity: 0.7;
  margin-left: 4px;
}

.addr-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.details-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field-error {
  @include text-xs;
  color: var(--color-error);
  margin: 0;
}
</style>
