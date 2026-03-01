export type TenantTheme = {
  primaryColor: string
  fontFamily: string
  logoUrl: string | null
  bannerUrl: string | null
  preset: 'default' | 'dark' | 'warm' | 'minimal'
}

export type TenantContacts = {
  phone: string
  email: string
  address: string
  city: string
  instagram: string | null
  vk: string | null
}

export type TenantWorkingHours = {
  [day in 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun']: {
    open: string
    close: string
    closed: boolean
  }
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
  workingHours: TenantWorkingHours
  notifications: TenantNotifications
  subscription: TenantSubscription
  deliveryMinOrder: number
  deliveryFee: number
  createdAt: string
}
