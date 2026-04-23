import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessType, MenuStyle } from '@fastio/shared'
import type { ModuleConfig } from '~/config/modules'
import { query } from '~/utils/query'

const mapModuleConfig = (row: Record<string, unknown>): ModuleConfig => ({
  key: row.key as ModuleConfig['key'],
  name: row.name as string,
  description: row.description as string,
  icon: row.icon as ModuleConfig['icon'],
  requiredPlan: row.required_plan_key as string,
  sortOrder: row.sort_order as number,
  businessTypes: (row.business_types as BusinessType[]) ?? ['retail', 'services'],
  menuStyles: (row.menu_styles as MenuStyle[] | null) ?? null,
})

export const moduleConfigsApi = {
  async list(sb: SupabaseClient): Promise<ModuleConfig[]> {
    const data = await query(
      sb.from('module_configs').select('*').eq('is_active', true).order('sort_order'),
    )

    return (data ?? []).map(mapModuleConfig)
  },
}
