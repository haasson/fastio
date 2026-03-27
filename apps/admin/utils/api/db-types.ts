import type {
  TenantRole,
  TenantTheme,
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
} from '@fastio/shared'

export type TenantRow = {
  id: string
  owner_id: string
  name: string
  slug: string
  custom_domain: string | null
  business_type: BusinessType | null
  theme: TenantTheme
  site_layout: Record<string, unknown>
  site_content: SiteContent
  contacts: TenantContacts
  working_hours: string
  working_hours_schedule: WorkingHoursSchedule | null
  notifications: TenantNotifications
  balance: number
  subscription: TenantSubscription
  modules: TenantModules
  delivery_min_order: number
  delivery_fee: number
  delivery_description: string
  currency: string
  timezone: string
  seo: TenantSeo
  kitchen_urgency_minutes: number
  kitchen_config: KitchenConfig
  order_number_config: OrderNumberConfig | null
  max_addons_default: number | null
  onboarding_completed: boolean
  created_at: string
}

export type TenantMemberRow = {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  branch_ids: string[]
  blocked_until: string | null
  created_at: string
  tenants?: { id: string; name: string; slug: string } | null
}

export type TenantInvitationRow = {
  id: string
  tenant_id: string
  email: string
  role: TenantRole
  invited_by: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  branch_ids: string[]
}

export type CategoryRow = {
  id: string
  tenant_id: string
  name: string
  type: CategoryType
  tag_id: string | null
  sort_order: number
  active: boolean
  photo_url: string | null
  use_first_dish_photo: boolean
  deleted_at: string | null
}

export type ComboRow = {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  price: number
  photos: string[]
  active: boolean
  sort_order: number
  created_at: string
}

export type ComboItemRow = {
  id: string
  combo_id: string
  dish_id: string
  sort_order: number
  modifier_option_ids: string[]
}

export type DishRow = {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  price: number
  photos: string[]
  ingredients: DishIngredient[]
  nutrition: DishNutrition | null
  weight_unit: 'г' | 'мл'
  active: boolean
  sort_order: number
  requires_kitchen: boolean
  max_addons: number | null
  deleted_at: string | null
}

export type DishBranchPriceRow = {
  dish_id: string
  branch_id: string
  price: number | null
  active: boolean | null
}

export type ComboBranchSettingRow = {
  combo_id: string
  branch_id: string
  price: number | null
  active: boolean | null
}

export type OrderItemRow = {
  id: string
  order_id: string
  dish_id: string | null
  combo_id: string | null
  dish_name: string
  category_name: string | null
  price: number
  quantity: number
  removed_ingredients: string[]
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  sort_order: number
  completed_at: string | null
  combo_items: { dishName: string }[] | null
  added_by: string | null
  confirmed_by: string | null
  status: 'pending' | 'confirmed'
}

export type TableRow = {
  id: string
  tenant_id: string
  name: string
  is_open: boolean
  is_active: boolean
  opened_at: string | null
  created_at: string
  capacity: number | null
  tags: string[]
  position_x: number | null
  position_y: number | null
  shape: string
  table_width: number
  table_height: number
  rotation: number
  color: string | null
  notes: string | null
}

export type OrderRow = {
  id: string
  tenant_id: string
  customer_name: string | null
  customer_phone: string
  customer_email: string | null
  delivery_type: OrderDeliveryType
  address: string | null
  comment: string | null
  promo_code: string | null
  discount_amount: number
  subtotal: number
  delivery_fee: number
  total: number
  status: string
  payment_type: 'cash' | 'card' | 'online'
  branch_id: string | null
  delivery_zone_id: string | null
  table_id: string | null
  table_name: string | null
  idempotency_key: string | null
  order_number: string | null
  accepted_by: string | null
  created_at: string
  updated_at: string
  order_items?: OrderItemRow[]
}

export type OrderStatusRow = {
  id: string
  tenant_id: string
  name: string
  group_type: OrderStatusGroup
  position: number
  quick_actions: string[] | null
  kitchen_visible: boolean
}

export type OrderNoteRow = {
  id: string
  order_id: string
  tenant_id: string
  author_id: string
  author_name: string
  author_role: string
  content: string
  created_at: string
}

export type OrderEventRow = {
  id: string
  order_id: string
  tenant_id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  event_type: string
  meta: Record<string, unknown>
  created_at: string
}

export type TableCallTypeRow = {
  id: string
  tenant_id: string
  name: string
  sort_order: number
  created_at: string
}

export type TableCallRow = {
  id: string
  tenant_id: string
  table_id: string
  call_type_id: string | null
  call_type_name: string
  created_at: string
  resolved_at: string | null
}

export type KitchenQueueRow = {
  id: string
  tenant_id: string
  order_id: string
  order_item_id: string
  dish_name: string
  dish_id: string | null
  combo_id: string | null
  combo_name: string | null
  category_name: string | null
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  removed_ingredients: string[]
  delivery_type: OrderDeliveryType
  status: KitchenQueueStatus
  assigned_to: string | null
  assigned_at: string | null
  completed_at: string | null
  served_at: string | null
  served_by: string | null
  skip_kitchen: boolean
  created_at: string
}

export type BranchRow = {
  id: string
  tenant_id: string
  name: string
  color: string
  address: string | null
  phone: string | null
  is_active: boolean
  working_hours: string | null
  delivery_min_order: number | null
  delivery_fee: number | null
  notifications: TenantNotifications | null
  latitude: number | null
  longitude: number | null
  order_number_prefix: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}
