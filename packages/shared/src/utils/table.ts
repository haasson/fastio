import type { TableSettings, CanvasTileSize } from '../types/table'

// Единая правда дефолтов TableSettings — admin/storefront/маппер используют
// ОДНИ И ТЕ ЖЕ значения. Совпадает с DEFAULT'ами миграции 308_table_settings:
// тенант без строки в `table_settings` получает ровно эти значения, а не undefined.
export const DEFAULT_TABLE_SETTINGS: Omit<TableSettings, 'tenantId'> = {
  callButtonLabel: 'Официант',
  callButtonIcon: null,
  callCooldownSeconds: 30,
  callEscalationMinutes: 10,
  canvasTileSize: 's',
  showDishCategory: false,
}

export const mapTableSettings = (raw: Record<string, unknown>): TableSettings => ({
  tenantId: raw.tenant_id as string,
  callButtonLabel: (raw.call_button_label as string | null) ?? DEFAULT_TABLE_SETTINGS.callButtonLabel,
  callButtonIcon: (raw.call_button_icon as string | null) ?? DEFAULT_TABLE_SETTINGS.callButtonIcon,
  callCooldownSeconds: (raw.call_cooldown_seconds as number | null) ?? DEFAULT_TABLE_SETTINGS.callCooldownSeconds,
  callEscalationMinutes: (raw.call_escalation_minutes as number | null) ?? DEFAULT_TABLE_SETTINGS.callEscalationMinutes,
  canvasTileSize: (raw.canvas_tile_size as CanvasTileSize | null) ?? DEFAULT_TABLE_SETTINGS.canvasTileSize,
  showDishCategory: (raw.show_dish_category as boolean | null) ?? DEFAULT_TABLE_SETTINGS.showDishCategory,
})
