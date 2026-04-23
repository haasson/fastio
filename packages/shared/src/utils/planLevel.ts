import type { PlanTier } from '../types/tenant'

export const PLAN_LEVEL_ORDER: Record<PlanTier, number> = {
  showcase: 0,
  start: 1,
  pro: 2,
}

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  showcase: 'Витрина',
  start: 'Старт',
  pro: 'Про',
}

export const extractPlanTier = (key: string): string => key.replace(/^(?:retail|services)-/, '')

export const getPlanTierOrder = (key: string): number => PLAN_LEVEL_ORDER[extractPlanTier(key) as PlanTier] ?? 0
