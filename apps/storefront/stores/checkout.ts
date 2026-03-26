import { defineStore } from 'pinia'
import { reactive, ref, computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useAuthStore } from '~/stores/auth'

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
  entrance: string
  floor: string
  apartment: string
  intercom: string
  promoCode: string
  pickupBranchId: string | null
}

const FORM_DEFAULTS: CheckoutForm = {
  deliveryType: 'delivery',
  customerName: '',
  customerPhone: '',
  comment: '',
  paymentType: 'card',
  address: '',
  addressCoords: null,
  entrance: '',
  floor: '',
  apartment: '',
  intercom: '',
  promoCode: '',
  pickupBranchId: null,
}

export const useCheckoutStore = defineStore('checkout', () => {
  const form = reactive<CheckoutForm>({ ...FORM_DEFAULTS })

  const promoResult = ref<PromoResult | null>(null)
  const deliveryZone = ref<CheckoutDeliveryZone | null>(null)
  const outsideZones = ref(false)
  const hasZones = ref(false)

  function clearPromo() {
    promoResult.value = null
    form.promoCode = ''
  }

  function clearAddress() {
    form.address = ''
    form.addressCoords = null
    form.entrance = ''
    form.floor = ''
    form.apartment = ''
    form.intercom = ''
    deliveryZone.value = null
    outsideZones.value = false
  }

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

  function prefillFromAuth() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    if (authStore.customerName) form.customerName = authStore.customerName
    if (authStore.customerPhone) form.customerPhone = authStore.customerPhone
  }

  return {
    form,
    promoResult,
    deliveryZone,
    outsideZones,
    hasZones,
    clearPromo,
    clearAddress,
    prefillFromAuth,
    deliveryFee,
    discountAmount,
    orderTotal,
  }
})
