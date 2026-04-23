import type { BusinessType } from './tenant'

// Модули, которые открываются тарифом (все optional — здесь только то, что ДОБАВЛЯЕТ конкретный тариф).
// dashboard и team — "виртуальные" модули: их нет в TenantModules jsonb и они не переключаются вручную,
// доступ определяется исключительно тарифом.
export type PlanModuleFeatures = {
  dashboard?: boolean
  team?: boolean
  delivery?: boolean
  pickup?: boolean
  modifiers?: boolean
  addons?: boolean
  promotions?: boolean
  combos?: boolean
  kitchen?: boolean
  dineIn?: boolean
  reservations?: boolean
  services?: boolean
  branches?: boolean
  customRoles?: boolean
  customers?: boolean
}

// What a single plan tier ADDS (stored per plan in DB, only the delta)
export type PlanFeatures = {
  modules?: PlanModuleFeatures
  menu?: {
    virtualCategories?: boolean  // retail only
    ingredients?: boolean        // retail only
  }
  resources?: {
    max?: number  // services only, 0 = unlimited
  }
  site?: {
    telegramNotifications?: boolean
  }
}

// Accumulated resolved features for a tenant's current plan tier (all plans ≤ current level)
export type ResolvedFeatures = {
  modules: Required<PlanModuleFeatures>
  menu: { virtualCategories: boolean; ingredients: boolean }
  resources: { max: number }
  site: { telegramNotifications: boolean }
}

export const EMPTY_RESOLVED_FEATURES: ResolvedFeatures = {
  modules: {
    dashboard: false,
    delivery: false, pickup: false, modifiers: false, addons: false,
    promotions: false, combos: false, kitchen: false, dineIn: false,
    reservations: false, services: false, branches: false,
    customRoles: false, customers: false, team: false,
  },
  menu: { virtualCategories: false, ingredients: false },
  resources: { max: 0 },
  site: { telegramNotifications: false },
}

export type Plan = {
  id: string
  key: string
  businessType: BusinessType
  name: string
  description: string
  price: number
  sortOrder: number
  isActive: boolean
  features: PlanFeatures
  badge: string | null
  isFeatured: boolean
}

export type BillingTransactionType = 'topup' | 'charge' | 'refund'

export type BillingTransaction = {
  id: string
  tenantId: string
  type: BillingTransactionType
  amount: number
  description: string
  planId: string | null
  createdBy: string | null
  createdAt: string
}
