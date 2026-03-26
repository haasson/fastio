export type Plan = {
  id: string
  key: string
  name: string
  description: string
  price: number
  sortOrder: number
  isActive: boolean
  maxBranches: number // 0 = unlimited
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
