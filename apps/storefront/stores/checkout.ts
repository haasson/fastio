import { defineStore } from 'pinia'
import { reactive, ref, computed, watch } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

type PromoResult = {
  valid: boolean
  discount_type?: string
  discount_value?: number
  description?: string
}

export type CheckoutDeliveryZone = {
  id: string
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom: number | null
  effectiveDeliveryFee?: number
}

type CheckoutForm = {
  deliveryType: 'delivery' | 'pickup'
  customerName: string
  customerPhone: string
  comment: string
  paymentType: 'cash' | 'card'
  address: string
  addressCoords: { lat: number; lon: number } | null
  promoCode: string
}

const FORM_DEFAULTS: CheckoutForm = {
  deliveryType: 'delivery',
  customerName: '',
  customerPhone: '',
  comment: '',
  paymentType: 'card',
  address: '',
  addressCoords: null,
  promoCode: '',
}

export const useCheckoutStore = defineStore('checkout', () => {
  const form = reactive<CheckoutForm>({ ...FORM_DEFAULTS })

  // Runtime (not persisted)
  const promoResult = ref<PromoResult | null>(null)
  const deliveryZone = ref<CheckoutDeliveryZone | null>(null)
  const outsideZones = ref(false)
  const hasZones = ref(false)

  function persist() {
    if (import.meta.client) {
      localStorage.setItem('checkout', JSON.stringify(form))
    }
  }

  function restore() {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('checkout')
        if (raw) {
          Object.assign(form, JSON.parse(raw))
        }
      } catch {
        // ignore
      }
    }
  }

  function clearPromo() {
    promoResult.value = null
    form.promoCode = ''
  }

  function clearAddress() {
    form.address = ''
    form.addressCoords = null
    deliveryZone.value = null
    outsideZones.value = false
    persist()
  }

  // Totals
  const { data: tenant } = useNuxtData<Tenant>('tenant')

  const deliveryFee = computed(() => {
    if (form.deliveryType !== 'delivery') return 0
    if (deliveryZone.value) return deliveryZone.value.effectiveDeliveryFee ?? deliveryZone.value.deliveryFee
    if (!hasZones.value) return tenant.value?.deliveryFee ?? 0
    return 0
  })

  const discountAmount = computed(() => {
    const pr = promoResult.value
    if (!pr?.valid) return 0
    const subtotal = useCartStore().subtotal
    if (pr.discount_type === 'percent') {
      return Math.round(subtotal * (pr.discount_value ?? 0) / 100)
    }
    return Math.min(pr.discount_value ?? 0, subtotal)
  })

  const orderTotal = computed(() => useCartStore().subtotal - discountAmount.value + deliveryFee.value)

  // Auto-persist on form changes
  watch(form, persist, { deep: true })

  return {
    form,
    promoResult,
    deliveryZone,
    outsideZones,
    hasZones,
    persist,
    restore,
    clearPromo,
    clearAddress,
    deliveryFee,
    discountAmount,
    orderTotal,
  }
})
