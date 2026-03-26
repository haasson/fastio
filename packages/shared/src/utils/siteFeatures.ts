import type { TenantModules } from '../types/tenant'

type SiteFeatureDef = {
  label: string
  index: boolean
  page: boolean
  nav: boolean
  module?: keyof TenantModules
}

export const SITE_FEATURES = {
  categoryBar: { label: 'Панель категорий', index: true,  page: false, nav: false },
  hero:        { label: 'Хиро',             index: true,  page: false, nav: false },
  banners:     { label: 'Баннеры',          index: true,  page: false, nav: false },
  menu:        { label: 'Меню',             index: true,  page: true,  nav: true  },
  gallery:     { label: 'Галерея',          index: true,  page: true,  nav: true  },
  reviews:     { label: 'Отзывы',           index: true,  page: false, nav: true  },
  delivery:    { label: 'Доставка',         index: true,  page: true,  nav: true,  module: 'delivery'     },
  vacancies:   { label: 'Вакансии',         index: false, page: true,  nav: true  },
  booking:     { label: 'Бронирование',     index: false, page: true,  nav: true,  module: 'reservations' },
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

export const featureLabel = (key: string): string =>
  (SITE_FEATURES as Record<string, SiteFeatureDef>)[key]?.label ?? key

export const isFeatureAvailable = (key: string, modules: TenantModules): boolean => {
  const requiredModule = (SITE_FEATURES as Record<string, SiteFeatureDef>)[key]?.module
  if (!requiredModule) return true
  return modules[requiredModule] === true
}
