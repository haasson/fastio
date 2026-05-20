import { defineStore } from 'pinia'
import { reactive, ref, computed, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { localDateTimeToUtcIso, addDaysToDateStr, DEFAULT_TIMEZONE, formatPrice } from '@fastio/shared'
import { useCartStore, computeBranchCompat  } from '~/features/cart'
import { useMenuStore } from '~/features/menu-catalog'
import { useAuthStore } from '~/features/auth'
import { reportError } from '@fastio/shared/observability'

type AutoPromo = {
  promotionId: string
  title: string
  discountAmount: number
}

type PromoResult = {
  valid: boolean
  discount_type?: string
  discount_value?: number
  error?: string
}

type RawPromoCheck = { valid: boolean; discount_type?: string; discount_value?: number; min_order_amount?: number } | null

export type CheckoutDeliveryZone = {
  id: string
  branchId: string | null
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom: number | null
  effectiveDeliveryFee?: number
}

type CheckoutForm = {
  deliveryType: 'delivery' | 'pickup'
  customerName: string
  customerPhone: string
  customerEmail: string
  comment: string
  paymentType: 'cash' | 'card' | 'online'
  needsChange: boolean
  changeFrom: number | null
  address: string
  addressCoords: { lat: number; lon: number } | null
  entrance: string
  floor: string
  apartment: string
  intercom: string
  promoCode: string
  pickupBranchId: string | null
  schedulingMode: 'asap' | 'scheduled'
  scheduledDate: string
  scheduledTime: string
}

const FORM_DEFAULTS: CheckoutForm = {
  deliveryType: 'delivery',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  comment: '',
  paymentType: 'card',
  needsChange: false,
  changeFrom: null,
  address: '',
  addressCoords: null,
  entrance: '',
  floor: '',
  apartment: '',
  intercom: '',
  promoCode: '',
  pickupBranchId: null,
  schedulingMode: 'asap',
  scheduledDate: '',
  scheduledTime: '',
}

export const useCheckoutStore = defineStore('checkout', () => {
  const form = reactive<CheckoutForm>({ ...FORM_DEFAULTS })

  const promoResult = ref<PromoResult | null>(null)
  const autoPromo = ref<AutoPromo | null>(null)
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

  const scheduledAt = computed<string | null>(() => {
    if (form.schedulingMode !== 'scheduled' || !form.scheduledDate || !form.scheduledTime) return null
    const tz = tenant.value?.timezone ?? DEFAULT_TIMEZONE
    const rawTime = form.scheduledTime
    const isNextDay = rawTime.endsWith('+1')
    const timeStr = isNextDay ? rawTime.slice(0, -2) : rawTime
    const dateStr = isNextDay ? addDaysToDateStr(form.scheduledDate, 1) : form.scheduledDate
    return localDateTimeToUtcIso(dateStr, timeStr, tz)
  })

  const fetchAutoPromo = async (subtotal: number) => {
    if (subtotal <= 0) {
      autoPromo.value = null
      return
    }
    try {
      const data = await $fetch<{ promotion_id: string; title: string; discount_amount: number } | null>(
        '/api/promo/best',
        { params: { subtotal, ...(scheduledAt.value && { scheduledAt: scheduledAt.value }) } },
      )
      autoPromo.value = data
        ? { promotionId: data.promotion_id, title: data.title, discountAmount: data.discount_amount }
        : null
    } catch (err) {
      reportError(err)
      autoPromo.value = null
    }
  }

  function mapPromoError(raw: RawPromoCheck): string {
    if (raw?.min_order_amount != null) return `Минимальная сумма заказа — ${formatPrice(raw.min_order_amount)}`
    return 'Промокод недействителен'
  }

  async function applyPromoCode() {
    if (!form.promoCode.trim()) return
    const subtotal = useCartStore().subtotal
    const code = form.promoCode.trim()
    try {
      const result = await $fetch<RawPromoCheck>('/api/promo/check', {
        method: 'POST',
        body: { code, subtotal, scheduledAt: scheduledAt.value },
      })

      if (!result?.valid && scheduledAt.value) {
        // Check if it would be valid ignoring the delivery date
        const nowResult = await $fetch<RawPromoCheck>('/api/promo/check', {
          method: 'POST',
          body: { code, subtotal },
        })
        if (nowResult?.valid) {
          promoResult.value = { valid: false, error: 'Промокод не действует в указанную дату доставки' }
        } else {
          promoResult.value = { valid: false, error: mapPromoError(nowResult) }
        }
        return
      }

      promoResult.value = result?.valid
        ? { valid: true, discount_type: result.discount_type, discount_value: result.discount_value }
        : { valid: false, error: mapPromoError(result) }
    } catch (err) {
      reportError(err)
      promoResult.value = { valid: false, error: 'Промокод недействителен' }
    }
  }

  const deliveryFee = computed(() => {
    if (form.deliveryType !== 'delivery') return 0
    if (deliveryZone.value) return deliveryZone.value.effectiveDeliveryFee ?? deliveryZone.value.deliveryFee
    // Fixed mode: use tenant-level fee with free delivery threshold
    if (tenant.value?.deliveryMode === 'fixed') {
      const t = tenant.value
      if (t.freeDeliveryFrom > 0 && useCartStore().subtotal >= t.freeDeliveryFrom) return 0
      return t.deliveryFee ?? 0
    }
    return 0
  })

  const promoCodeDiscount = computed(() => {
    const subtotal = useCartStore().subtotal
    const pr = promoResult.value
    if (!pr?.valid) return 0
    return pr.discount_type === 'percent'
      ? Math.round(subtotal * (pr.discount_value ?? 0) / 100)
      : Math.min(pr.discount_value ?? 0, subtotal)
  })

  const discountAmount = computed(() => Math.max(promoCodeDiscount.value, autoPromo.value?.discountAmount ?? 0))

  // Which discount source is actually applied (the larger one wins)
  const appliedDiscount = computed<{ source: 'promo_code' | 'auto_promo'; label: string; isBestPick: boolean } | null>(() => {
    const pcd = promoCodeDiscount.value
    const ad = autoPromo.value?.discountAmount ?? 0
    if (pcd === 0 && ad === 0) return null
    const isBestPick = pcd > 0 && ad > 0
    if (pcd >= ad) return { source: 'promo_code', label: `Промокод ${form.promoCode}`, isBestPick }
    return { source: 'auto_promo', label: `Акция «${autoPromo.value!.title}»`, isBestPick }
  })

  const cartStore = useCartStore()
  watchDebounced(
    [() => cartStore.subtotal, scheduledAt],
    ([subtotal]) => fetchAutoPromo(subtotal),
    { debounce: 400, immediate: true },
  )

  // Re-validate promo code whenever scheduled delivery time changes (or clears back to ASAP)
  watch(scheduledAt, () => {
    if (form.promoCode) applyPromoCode()
  })

  const minOrderAmount = computed(() => {
    if (form.deliveryType !== 'delivery') return 0
    if (deliveryZone.value) return deliveryZone.value.minOrder
    if (tenant.value?.deliveryMode === 'fixed') return tenant.value.deliveryMinOrder ?? 0
    return 0
  })

  const belowMinOrder = computed(() => {
    const subtotal = useCartStore().subtotal
    return subtotal > 0 && minOrderAmount.value > 0 && subtotal < minOrderAmount.value
  })

  const orderTotal = computed(() => useCartStore().subtotal - discountAmount.value + deliveryFee.value)

  // Названия dish-позиций, которые не выполнит филиал, привязанный к выбранной зоне доставки.
  // Пусто, если: режим не delivery, режим тенанта per_branch (каталог уже отфильтрован),
  // нет совпавшей зоны/branchId, корзина без блюд, либо филиал тащит всё.
  const deliveryMissingItems = computed<{ name: string }[]>(() => {
    if (form.deliveryType !== 'delivery') return []
    if (tenant.value?.branchSelectionMode === 'per_branch') return []
    const branchId = deliveryZone.value?.branchId ?? null
    if (!branchId) return []
    const cs = useCartStore()
    if (cs.dishItems.length === 0) return []
    const menu = useMenuStore()
    const dishesById = new Map(menu.allDishes.map((d) => [d.id, d]))
    const compat = computeBranchCompat(
      cs.dishItems,
      dishesById,
      [{ id: branchId, name: '' }],
      menu.branchesAll.length,
    )
    const branchCompat = compat[0]
    if (!branchCompat || branchCompat.status === 'green') return []
    return branchCompat.missingNames.map((name) => ({ name }))
  })

  function prefillFromAuth() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    if (authStore.customerName) form.customerName = authStore.customerName
    if (authStore.customerPhone) form.customerPhone = authStore.customerPhone
    if (authStore.customerEmail) form.customerEmail = authStore.customerEmail
  }

  return {
    form,
    promoResult,
    autoPromo,
    deliveryZone,
    outsideZones,
    hasZones,
    clearPromo,
    clearAddress,
    prefillFromAuth,
    applyPromoCode,
    deliveryFee,
    minOrderAmount,
    belowMinOrder,
    discountAmount,
    appliedDiscount,
    orderTotal,
    deliveryMissingItems,
  }
})
