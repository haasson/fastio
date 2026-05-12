// Public barrel of the billing module.
// Низкоуровневые CRUD API (plansApi, billingApi) — здесь.
// Composables (usePlans/useBillingConfig/usePlanFeatures) живут в shared/plan/*
// как общая инфра — их используют гейты и UI вне billing-кабинета.
// components/ — UI billing-cabinet'а (BillingSummary, PlanCards, TransactionHistory).

// API
export * from './api/billing'
export * from './api/plans'
