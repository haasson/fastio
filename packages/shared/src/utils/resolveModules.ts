import type { BusinessType, TenantModules } from '../types/tenant'

const DISABLED_FOR_BUSINESS_TYPE: Partial<Record<BusinessType, (keyof TenantModules)[]>> = {
  services: ['delivery', 'pickup', 'dineIn', 'kitchen', 'combos', 'promotions', 'reservations', 'modifiers', 'addons'],
}

export function resolveModules(modules: TenantModules, businessType: BusinessType | null): TenantModules {
  if (!businessType) return modules
  const disabled = DISABLED_FOR_BUSINESS_TYPE[businessType] ?? []
  if (!disabled.length) return modules
  return { ...modules, ...Object.fromEntries(disabled.map((k) => [k, false])) }
}
