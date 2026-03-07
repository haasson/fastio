import type {
  TenantRole,
  TenantTheme,
  TenantContacts,
  TenantNotifications,
  TenantSubscription,
  OrderCustomer,
  OrderItem,
  OrderDeliveryType,
  OrderStatusGroup,
  DishIngredient,
  DishNutrition,
  DishTag,
} from '@fastio/shared'

export type TenantRow = {
  id: string
  owner_id: string
  name: string
  slug: string
  custom_domain: string | null
  theme: TenantTheme
  contacts: TenantContacts
  working_hours: string
  notifications: TenantNotifications
  subscription: TenantSubscription
  delivery_min_order: number
  delivery_fee: number
  created_at: string
}

export type TenantMemberRow = {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  branch_ids: string[]
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
}

export type CategoryRow = {
  id: string
  tenant_id: string
  name: string
  sort_order: number
  active: boolean
  photo_url: string | null
  use_first_dish_photo: boolean
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
  tags: DishTag[]
  active: boolean
  sort_order: number
}

export type DishBranchPriceRow = {
  dish_id: string
  branch_id: string
  price: number
}

export type OrderRow = {
  id: string
  tenant_id: string
  customer: OrderCustomer
  items: OrderItem[]
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
  created_at: string
}

export type OrderStatusRow = {
  id: string
  tenant_id: string
  name: string
  group_type: OrderStatusGroup
  position: number
  quick_actions: string[] | null
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

export type BranchRow = {
  id: string
  tenant_id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  working_hours: string | null
  delivery_min_order: number | null
  delivery_fee: number | null
  notifications: TenantNotifications | null
  created_at: string
  updated_at: string
  archived_at: string | null
}
