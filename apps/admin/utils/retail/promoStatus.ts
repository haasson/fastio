type PromoLike = {
  active: boolean
  activeFrom: string | null
  activeTo: string | null
}

export const effectivePromoStatus = (promo: PromoLike) => {
  if (!promo.active) return { key: 'inactive', type: 'error' as const, label: 'Выключен' }
  const now = Date.now()

  if (promo.activeFrom && new Date(promo.activeFrom).getTime() > now) return { key: 'scheduled', type: 'primary' as const, label: 'Запланирован' }
  if (promo.activeTo && new Date(promo.activeTo).getTime() < now) return { key: 'expired', type: 'warning' as const, label: 'Истёк' }

  return { key: 'active', type: 'success' as const, label: 'Активен' }
}

export const PROMO_STATUS_FILTER_OPTIONS = [
  { label: 'Активен', value: 'active' },
  { label: 'Выключен', value: 'inactive' },
  { label: 'Запланирован', value: 'scheduled' },
  { label: 'Истёк', value: 'expired' },
]
