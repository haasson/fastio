import type { TenantModules } from '../types/tenant'

type SiteFeatureDef = {
  label: string
  /** Переопределённое название для типа бизнеса services */
  servicesLabel?: string
  index: boolean
  page: boolean
  nav: boolean
  module?: keyof TenantModules
  /** Если задано — секция доступна только для этих типов бизнеса */
  businessTypes?: string[]
}

export const SITE_FEATURES = {
  categoryBar: { label: 'Панель категорий', servicesLabel: 'Панель категорий услуг', index: true,  page: false, nav: false },
  hero:        { label: 'Хиро',             index: true,  page: false, nav: false },
  banners:     { label: 'Баннеры',          index: true,  page: false, nav: false },
  menu:        { label: 'Меню',             servicesLabel: 'Услуги',                index: true,  page: true,  nav: true  },
  gallery:     { label: 'Галерея',          index: true,  page: true,  nav: true  },
  reviews:     { label: 'Отзывы',           index: true,  page: false, nav: true  },
  delivery:    { label: 'Доставка',         index: true,  page: true,  nav: true,  module: 'delivery' },
  // TODO: vacancies page — скрыто до реализации функционала
  vacancies:   { label: 'Вакансии',         index: false, page: false, nav: false },
  booking:     { label: 'Бронирование',     index: false, page: true,  nav: true,  module: 'dineIn' },
  about:       { label: 'О нас',            index: false, page: true,  nav: true  },
} as const satisfies Record<string, SiteFeatureDef>

export type SiteFeatureKey = keyof typeof SITE_FEATURES

export type SectionKey = {
  [K in SiteFeatureKey]: (typeof SITE_FEATURES)[K]['index'] extends true ? K : never
}[SiteFeatureKey]

export type NavPageKey = {
  [K in SiteFeatureKey]: (typeof SITE_FEATURES)[K]['nav'] extends true ? K : never
}[SiteFeatureKey]

export type PageKey = {
  [K in SiteFeatureKey]: (typeof SITE_FEATURES)[K]['page'] extends true ? K : never
}[SiteFeatureKey]

const keys = Object.keys(SITE_FEATURES) as SiteFeatureKey[]

export const SECTION_KEYS = keys.filter((k): k is SectionKey => SITE_FEATURES[k].index)
export const NAV_PAGE_KEYS = keys.filter((k): k is NavPageKey => SITE_FEATURES[k].nav)
export const PAGE_KEYS = keys.filter((k): k is PageKey => SITE_FEATURES[k].page)

/** Structural sections excluded from nav (always present, not user-selectable) */
export const STRUCTURAL_SECTIONS: readonly SectionKey[] = ['categoryBar', 'hero']

export const featureLabel = (key: string, businessType?: string | null): string => {
  const def = (SITE_FEATURES as Record<string, SiteFeatureDef>)[key]
  if (!def) return key
  if (businessType === 'services' && def.servicesLabel) return def.servicesLabel
  return def.label
}

export const isFeatureAvailable = (key: string, modules: TenantModules, businessType?: string | null): boolean => {
  const def = (SITE_FEATURES as Record<string, SiteFeatureDef>)[key]
  if (!def) return true
  if (def.businessTypes && businessType && !def.businessTypes.includes(businessType)) return false
  if (!def.module) return true
  return modules[def.module] === true
}
