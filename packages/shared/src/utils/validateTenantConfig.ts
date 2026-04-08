import type { SiteLayout, SiteContent, TenantModules } from '../types/tenant'
import { SITE_FEATURES } from './siteFeatures'

export type ConfigIssueSeverity = 'error' | 'warning'

export type ConfigIssue = {
  severity: ConfigIssueSeverity
  code: string
  message: string
}

type FeatureEntry = {
  module?: keyof TenantModules
  label: string
}

const getFeature = (key: string): FeatureEntry | null =>
  (SITE_FEATURES as Record<string, FeatureEntry>)[key] ?? null

export const validateTenantConfig = (
  layout: SiteLayout,
  modules: TenantModules,
  content: SiteContent,
): ConfigIssue[] => {
  const issues: ConfigIssue[] = []

  // --- Navigation ---

  for (const item of layout.header.navItems) {
    if (item.action === 'scroll' && !layout.sectionsOrder.includes(item.key as any)) {
      const feature = getFeature(item.key)
      issues.push({
        severity: 'error',
        code: 'nav_scroll_no_section',
        message: `Навигация «${feature?.label ?? item.key}» ведёт к секции, но секция не добавлена на главную`,
      })
    }

    if (item.action === 'navigate' && !layout.pages.includes(item.key as any)) {
      const feature = getFeature(item.key)
      issues.push({
        severity: 'error',
        code: 'nav_navigate_no_page',
        message: `Навигация «${feature?.label ?? item.key}» ведёт на страницу, но страница не включена`,
      })
    }
  }

  // --- Sections requiring disabled modules ---

  for (const key of layout.sectionsOrder) {
    const feature = getFeature(key)
    const section = layout.sections[key as keyof typeof layout.sections] as { enabled?: boolean } | undefined
    if (feature?.module && !modules[feature.module] && section?.enabled !== false) {
      issues.push({
        severity: 'error',
        code: `section_module_disabled_${key}`,
        message: `Секция «${feature.label}» требует модуль, который выключен`,
      })
    }
  }

  // --- Pages requiring disabled modules ---

  for (const key of layout.pages) {
    const feature = getFeature(key)
    if (feature?.module && !modules[feature.module]) {
      issues.push({
        severity: 'error',
        code: `page_module_disabled_${key}`,
        message: `Страница «${feature.label}» требует модуль, который выключен`,
      })
    }
  }

  // --- Hero warnings ---

  if (layout.sectionsOrder.includes('hero' as any)) {
    const hero = layout.sections.hero
    if (hero.bgType === 'image' && !content.hero.bgUrl) {
      issues.push({
        severity: 'warning',
        code: 'hero_no_image',
        message: 'Хиро: выбран фон «изображение», но изображение не загружено',
      })
    }
    if (hero.bgType === 'gradient' && !hero.gradientId) {
      issues.push({
        severity: 'warning',
        code: 'hero_no_gradient',
        message: 'Хиро: выбран фон «градиент», но градиент не выбран',
      })
    }
  }

  // --- Gallery warnings ---

  if (layout.sectionsOrder.includes('gallery' as any)) {
    if (!layout.sections.gallery.galleryIds.length) {
      issues.push({
        severity: 'warning',
        code: 'gallery_section_empty',
        message: 'Секция «Галерея» включена, но галереи не выбраны',
      })
    }
  }

  if (layout.pages.includes('gallery' as any)) {
    if (!layout.pageSettings.gallery.galleryIds.length) {
      issues.push({
        severity: 'warning',
        code: 'gallery_page_empty',
        message: 'Страница «Галерея» включена, но галереи не выбраны',
      })
    }
  }

  // --- Delivery warning ---

  if (layout.pages.includes('delivery' as any)) {
    if (layout.pageSettings.delivery.descriptionMode === 'manual' && !content.delivery.manualText) {
      issues.push({
        severity: 'warning',
        code: 'delivery_manual_empty',
        message: 'Доставка: режим «Текст вручную», но текст не заполнен',
      })
    }
  }

  // --- About warning ---

  if (layout.pages.includes('about' as any)) {
    if (!content.about.text) {
      issues.push({
        severity: 'warning',
        code: 'about_empty',
        message: 'Страница «О нас» включена, но текст не заполнен',
      })
    }
  }

  return issues
}
