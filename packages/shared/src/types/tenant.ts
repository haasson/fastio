import type { SectionKey, NavPageKey } from '../utils/siteFeatures'
import type { KitchenConfig } from './kitchen'

export type TenantThemePreset =
  | 'fresh' | 'dark' | 'forest' | 'sakura' | 'slate' | 'cream' | 'neon' | 'sunset' | 'ocean' | 'lemon' | 'ember' | 'garden' | 'midnight' | 'berry' | 'fiesta'
  | 'breeze' | 'lavender' | 'matcha' | 'latte' | 'frost' | 'peach'
  | 'graphite' | 'obsidian' | 'velvet' | 'matrix' | 'dusk' | 'nordic'
  | 'candy' | 'sunshine' | 'bubble' | 'tropical' | 'jellybean' | 'melon'
  | 'chalk' | 'sage' | 'teal' | 'plum' | 'sky' | 'moss' | 'blush' | 'indigo' | 'copper' | 'spruce'
  | 'espresso' | 'navy' | 'burgundy' | 'abyss' | 'pitch' | 'storm' | 'aubergine' | 'forge' | 'pine' | 'night'
  | 'neon-mint' | 'lollipop' | 'popsicle' | 'bubblegum' | 'mango' | 'cotton' | 'gummy' | 'festival' | 'dragonfly' | 'sorbet'

export type ThemePalette = {
  primary: string
  bg: string
  surface: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
}

export type CustomTheme = {
  id: string
  name: string
  basedOn: TenantThemePreset
  palette: ThemePalette
}

export type TenantTheme = {
  primaryColor: string
  fontFamily: string
  headingFontFamily: string
  preset: TenantThemePreset
  palette: ThemePalette | null
  buttonRadius: 'square' | 'rounded' | 'pill'
  cardRadius: number
  cardShadow: 'none' | 'subtle' | 'medium'
  customThemes: CustomTheme[]
  activeCustomId: string | null
}

export type SiteContent = {
  logo: string | null
  hero: {
    bgUrl: string | null
    text: string | null
  }
  about: {
    coverUrl: string | null
    text: string
  }
  delivery: {
    manualText: string
  }
}

export type NavItem = {
  key: string
  action: 'scroll' | 'navigate'
}

export type SiteLayout = {
  header: {
    showNav: boolean
    navItems: NavItem[]
    showPhone: boolean
    showWorkingHours: boolean
  }
  sections: {
    categoryBar: { enabled: boolean; overflow: 'scroll' | 'wrap' }
    hero: {
      enabled: boolean
      size: 'fullscreen' | 'content'
      bgType: 'none' | 'image' | 'video' | 'gradient'
      overlayColor: string
      overlayOpacity: number
      contentPosition: number
      contentAlign: 'left' | 'center' | 'right'
      gradientId: string
    }
    banners: {
      enabled: boolean
      title?: string
      displayMode: 'single' | 'auto'
      autoplay: boolean
      autoplayInterval: number
    }
    menu: { enabled: boolean; defaultView: 'categories' | 'dishes'; tagDisplayMode: 'text' | 'icon' | 'both'; dishDescriptionMode: 'below' | 'overlay'; mobileDishCard: 'vertical' | 'horizontal' }
    gallery: { enabled: boolean; galleryIds: string[] }
    reviews: { enabled: boolean }
    delivery: { enabled: boolean }
  }
  sectionsOrder: SectionKey[]
  pages: NavPageKey[]
  pageSettings: {
    menu: { defaultView: 'categories' | 'dishes'; tagDisplayMode: 'text' | 'icon' | 'both'; dishDescriptionMode: 'below' | 'overlay'; mobileDishCard: 'vertical' | 'horizontal' }
    delivery: { showMap: boolean; descriptionMode: 'auto' | 'manual' }
    gallery: { galleryIds: string[] }
  }
}

export type WorkingHours = {
  open: string   // "HH:MM"
  close: string  // "HH:MM"
  dayOff?: boolean   // only in days[n] — this day is a day off, open/close ignored
  allDay?: boolean   // only in default — 24/7, days and open/close ignored
}

export type WorkingHoursSchedule = {
  default: WorkingHours
  days: Record<string, WorkingHours>  // key: "1"=Mon .. "7"=Sun (ISO), only overrides
}

export type TenantLegalInfo = {
  legalName: string
  inn: string
  ogrn: string
  legalAddress: string
  privacyEmail: string
}

export function isLegalInfoComplete(legalInfo: TenantLegalInfo | null | undefined): boolean {
  if (!legalInfo) return false
  return !!(legalInfo.legalName?.trim() && legalInfo.inn?.trim() && legalInfo.ogrn?.trim() && legalInfo.legalAddress?.trim() && legalInfo.privacyEmail?.trim())
}

export type TenantContacts = {
  phone: string
  email: string
  address: string
  instagram: string | null
  vk: string | null
  telegram: string | null
  whatsapp: string | null
  max: string | null
  offerUrl: string | null
}

export type TenantNotifications = {
  email: string | null
  telegramChatId: string | null
  telegramThreadId?: number | null
  telegramChatTitle?: string | null
}

export type TenantSubscription = {
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'
  plan: string
  trialEndsAt: string | null
  renewsAt: string | null
  pastDueAt: string | null
  priceOverride: number | null
  gracePeriodDays: number | null
}

export type BusinessType = 'retail' | 'services'

export type MenuStyle = 'food' | 'catalog'

export type PlanTier = 'showcase' | 'start' | 'pro'

export type TenantModules = {
  delivery: boolean
  pickup: boolean
  modifiers: boolean
  addons: boolean
  promotions: boolean
  combos: boolean
  customRoles: boolean
  dineIn: boolean
  kitchen: boolean
  reservations: boolean
  customers: boolean
  services: boolean
  branches: boolean
}

export type OrderNumberFormat = 'counter' | 'prefix_counter' | 'date_counter' | 'prefix_date_counter'
export type OrderNumberScope = 'global' | 'per_branch'
export type OrderNumberDateFormat = 'DDMM' | 'DDMMYY' | 'YYYYMMDD'
export type OrderNumberResetPeriod = 'never' | 'daily'

export type OrderNumberConfig = {
  format: OrderNumberFormat
  scope: OrderNumberScope
  prefix: string
  dateFormat: OrderNumberDateFormat
  resetPeriod: OrderNumberResetPeriod
  padLength: number
  startFrom: number
}

export type TenantSeo = {
  metaTitle: string | null
  metaDescription: string | null
  ogImage: string | null
  favicon: string | null
  robots: 'index' | 'noindex'
  googleAnalyticsId: string | null
  yandexMetrikaId: string | null
}

export type DeliveryMode = 'fixed' | 'zones'

export type OrderSchedulingConfig = {
  enabled: boolean
  slotStep: number
  daysAhead: number
  deliveryLeadMinutes: number
  pickupLeadMinutes: number
  closeBufferMinutes: number
}

export const DEFAULT_SCHEDULING_CONFIG: OrderSchedulingConfig = {
  enabled: false,
  slotStep: 30,
  daysAhead: 3,
  deliveryLeadMinutes: 60,
  pickupLeadMinutes: 30,
  closeBufferMinutes: 30,
}

export function parseSchedulingConfig(raw: Record<string, unknown> | null | undefined): OrderSchedulingConfig {
  const d = DEFAULT_SCHEDULING_CONFIG
  if (!raw) return { ...d }
  return {
    enabled: (raw.enabled as boolean) ?? d.enabled,
    slotStep: (raw.slotStep as number) ?? d.slotStep,
    daysAhead: (raw.daysAhead as number) ?? d.daysAhead,
    deliveryLeadMinutes: (raw.deliveryLeadMinutes as number) ?? d.deliveryLeadMinutes,
    pickupLeadMinutes: (raw.pickupLeadMinutes as number) ?? d.pickupLeadMinutes,
    closeBufferMinutes: (raw.closeBufferMinutes as number) ?? d.closeBufferMinutes,
  }
}

export type Tenant = {
  id: string
  name: string
  slug: string
  customDomain: string | null
  ownerId: string
  businessType: BusinessType | null
  menuStyle: MenuStyle
  theme: TenantTheme
  siteLayout: SiteLayout
  siteContent: SiteContent
  contacts: TenantContacts
  workingHoursSchedule: WorkingHoursSchedule | null
  notifications: TenantNotifications
  balance: number
  subscription: TenantSubscription
  modules: TenantModules
  deliveryMinOrder: number
  deliveryFee: number
  freeDeliveryFrom: number
  deliveryDescription: string
  deliveryMode: DeliveryMode
  deliveryAvailable: boolean
  orderingEnabled: boolean
  currency: string
  timezone: string
  seo: TenantSeo
  kitchenUrgencyMinutes: number
  kitchenConfig: KitchenConfig
  orderNumberConfig: OrderNumberConfig | null
  maxAddonsDefault: number | null
  onboardingCompleted: boolean
  orderSchedulingConfig: OrderSchedulingConfig
  legalInfo: TenantLegalInfo | null
  createdAt: string
}
