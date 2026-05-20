import { ref, computed, onMounted, watch, type Ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import type { Order } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '@fastio/shared/observability'

type PromoOption = { label: string; value: string; type: 'promotion' | 'promo_code' | 'group'; id: string; children?: PromoOption[] }

type PromoForm = {
  discountAmount: number
  promoCode: string
}

type CheckResult = { valid: boolean; discountAmount: number; error?: string; title?: string }

type RawPromotion = { id: string; title: string; active: boolean; activeFrom: string | null; activeTo: string | null }
type RawPromoCode = { id: string; code: string; active: boolean; activeFrom: string | null; activeTo: string | null }

export const useOrderPromo = (
  tenantId: string,
  order: Ref<Order | null>,
  isEdit: Ref<boolean>,
  form: PromoForm,
  subtotal: Ref<number>,
  scheduledAt: Ref<string | null>,
) => {
  const api = useDatabase()

  // /api/promo/* требует JWT (requireMemberOfTenant), а $fetch его сам не приклеивает.
  async function authHeaders(): Promise<Record<string, string>> {
    const token = await api.auth.getAccessToken()

    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const rawPromotions = ref<RawPromotion[]>([])
  const rawPromoCodes = ref<RawPromoCode[]>([])

  const selectedPromoValue = ref<string | null>(null)
  const autoPromotionId = ref<string | null>(null)
  const promoError = ref<string | null>(null)
  const autoPromoEnabled = ref(true)

  type BestPromo = { promotionId: string; title: string; discountAmount: number; value: string }
  const bestPromo = ref<BestPromo | null>(null)

  const promoOptions = computed<PromoOption[]>(() => {
    const refTime = scheduledAt.value ? new Date(scheduledAt.value) : new Date()
    const isActiveAt = (activeFrom: string | null, activeTo: string | null) => (!activeFrom || new Date(activeFrom) <= refTime) && (!activeTo || new Date(activeTo) >= refTime)

    const activePromotions = rawPromotions.value.filter((p) => p.active && isActiveAt(p.activeFrom, p.activeTo))
    const activePromoCodes = rawPromoCodes.value.filter((c) => c.active && isActiveAt(c.activeFrom, c.activeTo))

    return [
      { label: '— Не применять —', value: '', type: 'promotion' as const, id: '' },
      ...(activePromotions.length
        ? [{
            label: 'Акции',
            value: '__group_promo',
            type: 'group' as const,
            id: '',
            children: activePromotions.map((p) => ({
              label: p.title,
              value: `promo:${p.id}`,
              type: 'promotion' as const,
              id: p.id,
            })),
          }]
        : []),
      ...(activePromoCodes.length
        ? [{
            label: 'Промокоды',
            value: '__group_codes',
            type: 'group' as const,
            id: '',
            children: activePromoCodes.map((c) => ({
              label: c.code,
              value: `code:${c.id}:${c.code}`,
              type: 'promo_code' as const,
              id: c.id,
            })),
          }]
        : []),
    ]
  })

  onMounted(async () => {
    const [promotions, promoCodes] = await Promise.all([
      api.promotions.list(tenantId),
      api.promoCodes.list(tenantId),
    ])

    rawPromotions.value = promotions as RawPromotion[]
    rawPromoCodes.value = promoCodes as RawPromoCode[]

    const o = order.value

    if (o?.promotionId) {
      const allChildren = promoOptions.value.flatMap((opt) => opt.children ?? [opt])
      const match = allChildren.find((opt) => opt.value === `promo:${o.promotionId}`)

      if (match) selectedPromoValue.value = match.value
    } else if (o?.promoCode) {
      const allChildren = promoOptions.value.flatMap((opt) => opt.children ?? [opt])
      const match = allChildren.find(
        (opt) => opt.type === 'promo_code' && opt.value.endsWith(`:${o.promoCode}`),
      )

      if (match) selectedPromoValue.value = match.value
    }
  })

  watchDebounced(subtotal, (val) => syncPromoDiscount(val), { debounce: 400, immediate: true })

  const bestPromoHint = computed<{ text: string; value: string } | null>(() => {
    const bp = bestPromo.value

    if (!bp || bp.discountAmount <= 0) return null

    // If best promo is already selected — no hint needed
    if (selectedPromoValue.value === bp.value) return null
    // If auto-promo is applied (no manual selection) and it's the same — no hint
    if (!selectedPromoValue.value && autoPromotionId.value === bp.promotionId) return null
    // Show hint only if best promo gives more than current discount
    if (bp.discountAmount <= form.discountAmount) return null

    return { text: `«${bp.title}» даст скидку ${formatPrice(bp.discountAmount)}`, value: bp.value }
  })

  // When scheduled delivery time changes — re-validate selected promo with visible error
  watch(scheduledAt, async () => {
    if (selectedPromoValue.value) {
      await applyPromoOption(selectedPromoValue.value, subtotal.value, true)
    } else if (autoPromoEnabled.value) {
      syncPromoDiscount(subtotal.value)
    }
  })

  async function fetchBestPromo(sub: number) {
    if (sub <= 0) {
      bestPromo.value = null

      return null
    }
    try {
      const result = await $fetch<{ promotion_id: string; discount_amount: number; title: string } | null>(
        '/api/promo/best',
        {
          headers: await authHeaders(),
          params: { tenantId, subtotal: sub, ...(scheduledAt.value && { scheduledAt: scheduledAt.value }) },
        },
      )

      bestPromo.value = result
        ? { promotionId: result.promotion_id, title: result.title, discountAmount: result.discount_amount, value: `promo:${result.promotion_id}` }
        : null

      return result
    } catch (err) {
      reportError(err)
      bestPromo.value = null

      return null
    }
  }

  async function syncPromoDiscount(val: number) {
    if (selectedPromoValue.value) {
      await Promise.all([
        applyPromoOption(selectedPromoValue.value, val, false),
        fetchBestPromo(val),
      ])

      return
    }

    if (!isEdit.value) {
      if (val <= 0 || !autoPromoEnabled.value) {
        form.discountAmount = 0
        autoPromotionId.value = null
        bestPromo.value = null

        return
      }
      try {
        const result = await fetchBestPromo(val)

        form.discountAmount = result?.discount_amount ?? 0
        autoPromotionId.value = result?.promotion_id ?? null
      } catch (err) { reportError(err) }
    } else if (order.value?.promotionId && autoPromoEnabled.value) {
      // Re-validation of existing order: structural only, no error display
      try {
        const [result] = await Promise.all([
          $fetch<{ discountAmount: number }>(
            '/api/promo/recalculate',
            {
              headers: await authHeaders(),
              params: { tenantId, promotionId: order.value.promotionId, subtotal: val, ...(scheduledAt.value && { scheduledAt: scheduledAt.value }) },
            },
          ),
          fetchBestPromo(val),
        ])

        form.discountAmount = result.discountAmount
        autoPromotionId.value = result.discountAmount > 0 ? order.value.promotionId : null
      } catch (err) { reportError(err) }
    } else {
      await fetchBestPromo(val)
    }
  }

  // showError=true for manual selection or date change, false for subtotal re-calculation
  async function applyPromoOption(value: string, sub = subtotal.value, showError = true) {
    if (value.startsWith('promo:')) {
      const promotionId = value.slice('promo:'.length)

      try {
        const result = await $fetch<CheckResult>(
          '/api/promo/check-promotion',
          {
            method: 'POST',
            headers: await authHeaders(),
            body: { tenantId, promotionId, subtotal: sub, scheduledAt: scheduledAt.value },
          },
        )

        form.discountAmount = result.discountAmount
        form.promoCode = ''
        autoPromotionId.value = result.valid ? promotionId : null
        if (showError) promoError.value = result.error ?? null
      } catch (err) { reportError(err) }
    } else if (value.startsWith('code:')) {
      const code = value.split(':').slice(2).join(':')

      try {
        const result = await $fetch<CheckResult>(
          '/api/promo/check',
          {
            method: 'POST',
            headers: await authHeaders(),
            body: { tenantId, code, subtotal: sub, scheduledAt: scheduledAt.value },
          },
        )

        form.discountAmount = result.discountAmount
        form.promoCode = result.valid ? code : ''
        autoPromotionId.value = null
        if (showError) promoError.value = result.error ?? null
      } catch (err) { reportError(err) }
    }
  }

  async function onPromoSelect(value: string | null) {
    const cleared = !value || value === ''

    selectedPromoValue.value = cleared ? null : value
    promoError.value = null
    if (cleared) {
      autoPromoEnabled.value = false
      form.discountAmount = 0
      form.promoCode = ''
      autoPromotionId.value = null

      return
    }
    autoPromoEnabled.value = true
    await applyPromoOption(value, subtotal.value, true)
  }

  return { promoOptions, selectedPromoValue, autoPromotionId, promoError, bestPromoHint, onPromoSelect }
}
