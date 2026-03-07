export type TenantTheme = {
  primaryColor: string
  fontFamily: string
  logoUrl: string | null
  bannerUrl: string | null
  preset: 'default' | 'dark' | 'warm' | 'minimal'
}

export type TenantContacts = {
  phoneMode: 'shared' | 'per_branch'
  phone: string
  email: string
  address: string
  instagram: string | null
  vk: string | null
  telegram: string | null
  whatsapp: string | null
}

export type TenantNotifications = {
  email: string | null
  telegramChatId: string | null
}

export type TenantSubscription = {
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  plan: 'basic' | 'pro'
  trialEndsAt: string | null
  renewsAt: string | null
}

export type Tenant = {
  id: string
  name: string
  slug: string
  customDomain: string | null
  ownerId: string
  theme: TenantTheme
  contacts: TenantContacts
  workingHours: string
  notifications: TenantNotifications
  subscription: TenantSubscription
  deliveryMinOrder: number
  deliveryFee: number
  deliveryDescription: string
  createdAt: string
}
