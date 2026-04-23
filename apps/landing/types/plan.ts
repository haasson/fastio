import type { BusinessType, PlanFeatures } from '@fastio/shared'

export type LandingPlanRow = {
  key: string
  business_type: BusinessType
  name: string
  description: string
  price: number
  sort_order: number
  badge: string | null
  is_featured: boolean
  features: PlanFeatures
}
