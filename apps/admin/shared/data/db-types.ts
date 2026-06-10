// Доменные Row-типы admin-приложения.
//
// Большая часть полей подтягивается из автогенерированного `database.types.ts`
// (Supabase CLI: `pnpm db:gen-types`). Над generated row-типами накладываются
// overrides для полей JSON/enum — там generated отдаёт сырой `Json`/`string`,
// а нам нужны типизированные доменные структуры из `@fastio/shared`.
//
// При изменении схемы БД:
// 1) `pnpm db:gen-types` — обновляет `database.types.ts`.
// 2) Если в новой/изменённой таблице есть JSON/enum поле — добавить override
//    ниже с типом из `@fastio/shared`.
//
// Сами Row-типы (`TenantRow`, `OrderRow`, ...) — это `Tables<'foo'>` после
// наложения overrides. Список колонок берётся из generated; ручной список
// поддерживать не надо.

import type {
  RolePermissions,
  TenantTheme,
  TenantColorPalettes,
  TenantContacts,
  TenantNotifications,
  TenantSubscription,
  TenantModules,
  TenantSeo,
  BusinessType,
  SiteContent,
  OrderDeliveryType,
  OrderStatusGroup,
  OrderItemModifier,
  OrderItemAddon,
  DishIngredient,
  DishNutrition,
  CategoryType,
  KitchenQueueStatus,
  KitchenConfig,
  OrderNumberConfig,
  WorkingHoursSchedule,
  AppointmentStatus,
  AppointmentResourceMode,
  StaffNameFormat,
  ResourceType,
  BookingMode,
  ScheduleTemplateType,
  AppointmentEventType,
  CanvasTileSize,
  JournalSource,
} from '@fastio/shared'

import type { Tables } from './database.types'

// Хелпер: накладывает overrides на generated row, заменяя `Json`/`string` на
// типизированные доменные структуры. Имена полей — те же, тип — переопределённый.
type WithOverrides<T, O> = Omit<T, keyof O> & O

// ─── Tenants ──────────────────────────────────────────────────────────────────

type TenantOverrides = {
  business_type: BusinessType | null
  theme: TenantTheme
  site_layout: Record<string, unknown>
  site_content: SiteContent
  contacts: TenantContacts
  working_hours_schedule: WorkingHoursSchedule | null
  notifications: TenantNotifications
  subscription: TenantSubscription
  modules: TenantModules
  seo: TenantSeo
  kitchen_config: KitchenConfig
  order_number_config: OrderNumberConfig | null
  onboarding_state: {
    current_step_id: string | null
    completed_at: string | null
    dismissed_at: string | null
  }
  order_scheduling_config: Record<string, unknown>
  legal_info: Record<string, unknown> | null
  branch_selection_mode: 'unified' | 'per_branch'
  color_palettes: Partial<TenantColorPalettes>
}

export type TenantRow = WithOverrides<Tables<'tenants'>, TenantOverrides>

export type TenantRoleRow = WithOverrides<Tables<'tenant_roles'>, {
  permissions: RolePermissions
}>

export type TenantMemberRow = Tables<'tenant_members'> & {
  tenants?: { id: string; name: string; slug: string } | null
  tenant_roles?: { id: string; name: string; permissions: RolePermissions } | null
}

// Отражает явный select в invitationsApi.list (не полную строку БД!).
// `token` намеренно отсутствует — см. комментарий в TenantInvitation типе.
// Если когда-нибудь добавится копирование ссылки — отдельный server endpoint
// должен читать токен напрямую из tenant_invitations и не возвращать его как
// часть list-team response.
export type TenantInvitationListRow = Pick<
  Tables<'tenant_invitations'>,
  'id' | 'tenant_id' | 'email' | 'role_id' | 'invited_by' | 'expires_at' | 'accepted_at' | 'created_at' | 'branch_ids'
> & {
  tenant_roles?: { id: string; name: string } | null
}

// ─── Menu (categories / combos / dishes / order_items / tables) ───────────────

export type CategoryRow = WithOverrides<Tables<'categories'>, {
  type: CategoryType
  kind: 'food' | 'service'
}>

export type ComboRow = Tables<'combos'>

export type ComboItemRow = Tables<'combo_items'>

export type DishRow = WithOverrides<Tables<'dishes'>, {
  ingredients: DishIngredient[]
  nutrition: DishNutrition | null
  weight_unit: 'г' | 'мл'
}>

export type OrderItemRow = WithOverrides<Tables<'order_items'>, {
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  combo_items: { dishName: string }[] | null
  status: 'pending' | 'confirmed'
}>

export type TableRow = Tables<'tables'>

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderRow = WithOverrides<Tables<'orders'>, {
  delivery_type: OrderDeliveryType
  payment_type: 'cash' | 'card' | 'online'
}> & {
  order_items?: OrderItemRow[]
  // Подтягивается join'ом из `branches` (см. `mapOrder` в features/orders).
  branch_address?: string | null
  visited_statuses: string[] | null
  // Миграция 325 (dine-in чек) — добавлено вручную (db:gen-types недоступен локально, см. MEMORY).
  check_status: 'open' | 'settled' | 'cancelled' | null
  settled_at: string | null
  settled_by: string | null
}

export type OrderStatusRow = WithOverrides<Tables<'order_statuses'>, {
  group_type: OrderStatusGroup
  quick_actions: string[] | null
}>

export type OrderNoteRow = Tables<'order_notes'>

export type AuditLogRow = WithOverrides<Tables<'audit_logs'>, {
  payload: Record<string, unknown>
}> & {
  // Миграция 321 — добавлено вручную (db:gen-types недоступен локально, см. MEMORY).
  changed_fields: string[]
  search_text: string | null
  parent_type: string | null
  parent_id: string | null
}

export type OrderEventRow = WithOverrides<Tables<'order_events'>, {
  meta: Record<string, unknown>
}>

// Строка возврата RPC `journal_events` (миграция — единый журнал audit + order).
// Это не таблица, а SETOF из функции — колонки описываем вручную (snake_case).
export type JournalEventRow = {
  id: string
  source: JournalSource
  event_type: string
  occurred_at: string
  branch_id: string | null
  actor_id: string | null
  actor_name: string | null
  entity_type: string
  entity_id: string
  entity_name: string | null
  payload: Record<string, unknown> | null
  changed_fields: string[] | null
}

// ─── Tables (zoom / table calls) ──────────────────────────────────────────────

export type TableCallTypeRow = Tables<'table_call_types'>

export type TableCallRow = Tables<'table_calls'>

export type TableSettingsRow = WithOverrides<Tables<'table_settings'>, {
  canvas_tile_size: CanvasTileSize
}> & {
  // Миграция 313 — добавлено вручную (db:gen-types недоступен локально, см. MEMORY).
  dine_in_ordering_enabled: boolean
  waiter_call_enabled: boolean
  // Миграция 315 — приём онлайн-броней (под-флаг модуля «Столы»).
  booking_enabled: boolean
}

// ─── Kitchen ──────────────────────────────────────────────────────────────────

export type KitchenQueueRow = WithOverrides<Tables<'kitchen_queue'>, {
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  removed_ingredients: string[]
  delivery_type: OrderDeliveryType
  status: KitchenQueueStatus
}> & {
  // Опционально подтянуто join'ом из `orders` (в некоторых channel-payload'ах
  // эти поля приходят без объекта `orders`).
  scheduled_at?: string | null
  kitchen_lead_minutes?: number | null
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export type BranchRow = WithOverrides<Tables<'branches'>, {
  address_data: Record<string, unknown>
  working_hours_schedule: WorkingHoursSchedule | null
  notifications: TenantNotifications | null
}>

// ─── Appointments / Services / Resources / Schedule templates ─────────────────
//
// Соответствуют миграциям 179..197.

export type AppointmentRow = WithOverrides<Tables<'appointments'>, {
  status: AppointmentStatus
}>

export type AppointmentEventRow = WithOverrides<Tables<'appointment_events'>, {
  event_type: AppointmentEventType
  meta: Record<string, unknown>
}>

export type AppointmentSettingsRow = WithOverrides<Tables<'appointment_settings'>, {
  resource_mode: AppointmentResourceMode
  staff_name_format: StaffNameFormat
}>

export type ServiceRow = WithOverrides<Tables<'services'>, {
  booking_mode: BookingMode
}>

// Категории услуг живут в общей таблице `categories` с kind='service' (см. миграцию 186).
// Тип `ServiceCategoryRow` удалён.

export type ServiceBranchRow = Tables<'service_branches'>

export type ServiceResourceRow = Tables<'service_resources'>

export type ResourceRow = WithOverrides<Tables<'resources'>, {
  type: ResourceType
}>

export type ResourceCategoryRow = Tables<'resource_categories'>

export type ResourceBranchRow = Tables<'resource_branches'>

export type ResourceScheduleRow = Tables<'resource_schedules'>

export type ResourceDisabledSlotRow = Tables<'resource_disabled_slots'>

export type ResourceDateOverrideRow = Tables<'resource_date_overrides'>

export type ResourceDateDisabledSlotRow = Tables<'resource_date_disabled_slots'>

export type ResourceUnavailabilityRow = WithOverrides<Tables<'resource_unavailability'>, {
  reason: 'vacation' | 'sick_leave' | 'training' | 'other'
}>

export type ScheduleTemplateRow = WithOverrides<Tables<'schedule_templates'>, {
  type: ScheduleTemplateType
}>

export type ScheduleTemplateDayRow = Tables<'schedule_template_days'>
