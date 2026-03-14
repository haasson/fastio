export type DiscountType = 'percent' | 'fixed'

export type Promotion = {
  id: string
  tenantId: string
  title: string
  description: string
  bannerUrl: string | null
  discountType: DiscountType
  discountValue: number
  activeFrom: string | null
  activeTo: string | null
  active: boolean
  branchIds: string[]
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
