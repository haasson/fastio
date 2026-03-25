import type { OrderItemModifier } from './modifier'

export type DiscountType = 'percent' | 'fixed'

export type PromotionType = 'min_order' | 'happy_hour' | 'weekday' | 'first_order' | 'free_item'

export type PromotionConditions = {
  minOrderAmount?: number
  timeFrom?: string    // "HH:MM"
  timeTo?: string      // "HH:MM"
  weekdays?: number[]  // 1=Mon, 7=Sun
  freeDishId?: string
  freeDishName?: string              // денормализованное имя для отображения
  freeDishCategoryName?: string      // денормализованная категория для отображения
  freeDishModifiers?: OrderItemModifier[]
}

export type Promotion = {
  id: string
  tenantId: string
  title: string
  type: PromotionType
  discountType: DiscountType
  discountValue: number
  conditions: PromotionConditions
  activeFrom: string | null
  activeTo: string | null
  active: boolean
}

export type PromotionFormData = {
  title: string
  type: PromotionType
  discountType: DiscountType
  discountValue: number
  conditions: PromotionConditions
  activeFrom: string | null
  activeTo: string | null
  active: boolean
}

export type PromoCode = {
  id: string
  tenantId: string
  code: string
  discountType: DiscountType
  discountValue: number
  usageLimit: number | null
  usedCount: number
  minOrderAmount: number | null
  activeFrom: string | null
  activeTo: string | null
  active: boolean
}

export type PromoCodeFormData = {
  code: string
  discountType: DiscountType
  discountValue: number
  usageLimit: number | null
  minOrderAmount: number | null
  activeFrom: string | null
  activeTo: string | null
  active: boolean
}

export type Banner = {
  id: string
  tenantId: string
  url: string
  enabled: boolean
  sortOrder: number
  promotionId: string | null
  promoCodeId: string | null
  link: string | null
  page: string | null
  content: string
  createdAt: string
}

export type BannerFormData = {
  url: string
  enabled: boolean
  promotionId: string | null
  promoCodeId: string | null
  link: string | null
  page: string | null
  content: string
}
