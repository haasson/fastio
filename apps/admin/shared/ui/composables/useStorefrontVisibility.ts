import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/shared/stores/tenant'
import {
  SITE_FEATURES,
  featureLabel,
  type SiteFeatureKey,
  type NavPageKey,
  type SectionKey,
} from '@fastio/shared'

export type StorefrontIssue = {
  type: 'page_disabled' | 'section_disabled' | 'nav_missing'
  message: string
  link: string
}

export const useStorefrontVisibility = (key: SiteFeatureKey) => {
  const tenantStore = useTenantStore()
  const { businessType } = storeToRefs(tenantStore)
  const def = SITE_FEATURES[key]

  const layout = computed(() => tenantStore.tenant.siteLayout)
  const label = computed(() => featureLabel(key, businessType.value))

  const isPageEnabled = computed(
    () => layout.value?.pages?.includes(key as NavPageKey) ?? false,
  )

  const isSectionEnabled = computed(
    () => layout.value?.sectionsOrder?.includes(key as SectionKey) ?? false,
  )

  const isInNav = computed(
    () => layout.value?.header?.navItems?.some((i) => i.key === key) ?? false,
  )

  const issues = computed((): StorefrontIssue[] => {
    if (!layout.value) return []

    const result: StorefrontIssue[] = []

    if (def.page && !isPageEnabled.value) {
      result.push({
        type: 'page_disabled',
        message: `Страница «${label.value}» не включена на витрине`,
        link: '/appearance/pages',
      })
    }

    if (def.index && !isSectionEnabled.value) {
      result.push({
        type: 'section_disabled',
        message: `Секция «${label.value}» не отображается на главной странице`,
        link: '/appearance/sections',
      })
    }

    if (def.nav && !isInNav.value) {
      result.push({
        type: 'nav_missing',
        message: `«${label.value}» не добавлено в навигацию шапки`,
        link: '/appearance/sections?open=header',
      })
    }

    return result
  })

  return { isPageEnabled, isSectionEnabled, isInNav, issues }
}
