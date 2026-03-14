import type { SectionKey, NavPageKey } from '../utils/siteFeatures'

export type TenantThemePreset = 'fresh' | 'dark' | 'forest' | 'sakura' | 'slate' | 'cream' | 'neon' | 'sunset' | 'ocean' | 'lemon' | 'ember' | 'garden' | 'midnight' | 'berry' | 'fiesta'

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
  preset: TenantThemePreset
  palette: ThemePalette | null
  buttonRadius: 'square' | 'rounded' | 'pill'
  cardRadius: number
  cardShadow: 'none' | 'subtle' | 'medium'
  customThemes: CustomTheme[]
  activeCustomId: string | null
}

export type NavPage = NavPageKey

export type BannerItem = {
  url: string
  enabled: boolean
}

export type SiteContent = {
  logo: string | null
  hero: {
    bgUrl: string | null
    text: string | null
  }
  banners: BannerItem[]
}

export type NavItem = {
  page: NavPage
  placement: 'index' | 'page'
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
      bgType: 'none' | 'image' | 'video'
      overlayColor: string
      overlayOpacity: number
      contentPosition: number
      contentAlign: 'left' | 'center' | 'right'
    }
    banners: {
      enabled: boolean
      title?: string
      displayMode: 'single' | 'auto'
      autoplay: boolean
      autoplayInterval: number
    }
    menu: { enabled: boolean; defaultView: 'categories' | 'dishes' }
    gallery: { enabled: boolean }
    reviews: { enabled: boolean }
    delivery: { enabled: boolean }
    vacancies: { enabled: boolean }
  }
  sectionsOrder: SectionKey[]
  pages: NavPage[]
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
  siteLayout: SiteLayout
  siteContent: SiteContent
  contacts: TenantContacts
  workingHours: string
  notifications: TenantNotifications
  subscription: TenantSubscription
  deliveryEnabled: boolean
  deliveryMinOrder: number
  deliveryFee: number
  deliveryDescription: string
  currency: string
  timezone: string
  createdAt: string
}
