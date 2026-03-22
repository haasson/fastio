<template>
  <section class="form-section">
    <FsHeading as="h6" class="section-title">Адрес доставки</FsHeading>

    <div v-if="isAuthenticated && addresses.length > 0" class="saved-addresses">
      <button
        v-for="addr in addresses"
        :key="addr.id"
        class="saved-addr"
        :class="{ active: selectedAddressId === addr.id }"
        @click="selectSavedAddress(addr)"
      >
        <span class="addr-label">{{ addr.label || 'Адрес' }}</span>
        <span class="addr-text">{{ addr.address }}</span>
      </button>
    </div>

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
        <FsIconButton
          v-if="checkout.form.address"
          ariaLabel="Очистить адрес"
          variant="ghost"
          size="small"
          class="address-clear"
          @click="checkout.clearAddress()"
        >
          <X :size="14" />
        </FsIconButton>

        <FsDropdownList
          v-if="showSuggestions"
          :items="suggestionItems"
          @select="onSuggestionSelect"
        />
      </div>

      <p v-if="addressError" class="field-error">{{ addressError }}</p>

      <template v-if="!addressError">
        <FsAlert v-if="checkout.deliveryZone && !checkout.outsideZones" type="success" :icon="Check">
          Доставка:
          <strong v-if="zoneFee === 0">бесплатно</strong>
          <strong v-else>{{ zoneFee }} {{ currency }}</strong>
          <span v-if="checkout.deliveryZone.freeDeliveryFrom && zoneFee > 0" class="zone-hint">
            (бесплатно от {{ checkout.deliveryZone.freeDeliveryFrom }} {{ currency }})
          </span>
        </FsAlert>
        <FsAlert v-else-if="checkout.outsideZones" type="error" :icon="X">
          Адрес вне зоны доставки
        </FsAlert>
        <FsAlert v-else-if="addressCheckLoading" type="muted">
          Проверяем адрес...
        </FsAlert>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import type { CustomerAddress } from '@fastio/shared'
import { useCheckoutStore } from '~/stores/checkout'
import { useCartStore } from '~/stores/cart'
import { useAuthStore } from '~/stores/auth'
import { useAddressesStore } from '~/stores/addresses'
import type { DadataSuggestion } from '~/composables/useDadataSuggestions'
import { useDadataSuggestions } from '~/composables/useDadataSuggestions'
import { FsHeading, FsInput, FsIconButton, FsAlert, FsDropdownList } from '@fastio/public-ui'

type Props = {
  currency: string
}

defineProps<Props>()

const checkout = useCheckoutStore()
const cart = useCartStore()
const authStore = useAuthStore()
const addressesStore = useAddressesStore()
const { isAuthenticated } = storeToRefs(authStore)
const { addresses } = storeToRefs(addressesStore)
const selectedAddressId = ref<string | null>(null)

onMounted(async () => {
  if (isAuthenticated.value) {
    await addressesStore.fetch()
  }
})

function selectSavedAddress(addr: CustomerAddress) {
  selectedAddressId.value = addr.id
  checkout.form.address = addr.address
  if (addr.coordinates) {
    checkout.form.addressCoords = { lat: addr.coordinates.lat, lon: addr.coordinates.lng }
    addressVerified.value = true
    addressTouched.value = true
    checkAddress(addr.coordinates.lat, addr.coordinates.lng)
  }
}
const { suggestions, search, showSuggestions, hideSuggestionsDelayed, clear: clearSuggestions } = useDadataSuggestions()

const addressVerified = ref(false)
const addressTouched = ref(false)
const addressCheckLoading = ref(false)

const zoneFee = computed(() => checkout.deliveryZone?.effectiveDeliveryFee ?? checkout.deliveryZone?.deliveryFee ?? 0)

const suggestionItems = computed(() =>
  suggestions.value.map((s) => ({ value: s.value, label: s.value, _raw: s })),
)

function onSuggestionSelect(item: { value: string; [key: string]: unknown }) {
  selectAddress((item as { _raw: DadataSuggestion })._raw)
}

const addressError = computed(() => {
  if (!addressTouched.value) return ''
  if (!checkout.form.address.trim()) return 'Укажите адрес доставки'
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

async function selectAddress(suggestion: DadataSuggestion) {
  checkout.form.address = suggestion.value
  showSuggestions.value = false
  clearSuggestions()
  addressVerified.value = true
  addressTouched.value = true

  const lat = parseFloat(suggestion.data.geo_lat ?? '')
  const lon = parseFloat(suggestion.data.geo_lon ?? '')

  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    checkout.form.addressCoords = { lat, lon }
    await checkAddress(lat, lon)
  }
}

async function checkAddress(lat: number, lon: number) {
  addressCheckLoading.value = true
  try {
    const result = await $fetch<{
      zone: { id: string; deliveryFee: number; minOrder: number; freeDeliveryFrom: number | null; effectiveDeliveryFee?: number } | null
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
  } catch {
    checkout.deliveryZone = null
    checkout.outsideZones = false
  } finally {
    addressCheckLoading.value = false
  }
}

// Re-check delivery fee when cart subtotal changes (for freeDeliveryFrom threshold)
let subtotalTimer: ReturnType<typeof setTimeout> | null = null
watch(() => cart.subtotal, () => {
  const coords = checkout.form.addressCoords
  if (!coords) return
  if (subtotalTimer) clearTimeout(subtotalTimer)
  subtotalTimer = setTimeout(() => {
    checkAddress(coords.lat, coords.lon)
  }, 500)
})

// Инициализация при монтировании (если адрес уже был выбран ранее)
if (checkout.form.address && checkout.form.addressCoords) {
  addressVerified.value = true
}

defineExpose({
  isValid() {
    addressTouched.value = true
    return !addressError.value && !checkout.outsideZones
  },
})
</script>

<style scoped lang="scss">
.form-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  margin: 0 0 16px;
}

.address-field-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.address-input-wrap {
  position: relative;
}

.address-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
}

.zone-hint {
  opacity: 0.7;
  margin-left: 4px;
}

.field-error {
  font-size: 12px;
  color: var(--color-error);
  margin: 0;
}

.saved-addresses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.saved-addr {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
  font: inherit;
  background: none;

  &.active {
    border-color: var(--primary);
  }
}

.addr-label {
  font-size: 14px;
  font-weight: 600;
}

.addr-text {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
