import { reactive, ref, computed, watch } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { Tenant, SiteLayout, SiteContent, TenantSeo, ConfigIssue } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, defaultTheme, defaultSeo, deepMerge, getPresetPalette, validateTenantConfig, GA_ID_RE, YM_ID_RE } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useMessage } from '@fastio/ui'

const initSiteLayout = (t: Tenant | null): SiteLayout => deepMerge(defaultSiteLayout(), (t?.siteLayout ?? {}) as Partial<SiteLayout>)

const initTheme = (t: Tenant | null) => {
  const theme = { ...defaultTheme(), ...t?.theme }

  if (!theme.palette) {
    const presetPalette = getPresetPalette(theme.preset)

    theme.palette = presetPalette ? { ...presetPalette, primary: theme.primaryColor } : null
  }

  return theme
}

const initContent = (t: Tenant | null): SiteContent => deepMerge(defaultSiteContent(), (t?.siteContent ?? {}) as Partial<SiteContent>)

const initSeo = (t: Tenant | null): TenantSeo => ({ ...defaultSeo(), ...(t?.seo ?? {}) })

export type AppearanceFormContext = ReturnType<typeof useAppearanceForm>
export const AppearanceFormKey: InjectionKey<AppearanceFormContext> = Symbol('appearance:form')

export const useAppearanceForm = (tenant: Ref<Tenant | null>) => {
  const db = useDatabase()
  const tenantStore = useTenantStore()
  const { success, error: showError } = useMessage()

  const siteLayoutForm = reactive(initSiteLayout(tenant.value))
  const themeForm = reactive(initTheme(tenant.value))
  const contentForm = reactive(initContent(tenant.value))
  const seoForm = reactive(initSeo(tenant.value))

  const pendingLogoFile = ref<File | null>(null)
  const pendingHeroBgFile = ref<File | null>(null)
  const pendingAboutCoverFile = ref<File | null>(null)
  const pendingFaviconFile = ref<File | null>(null)
  const pendingOgImageFile = ref<File | null>(null)
  let originalHeroBgUrl: string | null = null
  let originalAboutCoverUrl: string | null = null

  const savedSiteLayoutSnapshot = ref(JSON.stringify(siteLayoutForm))
  const savedThemeSnapshot = ref(JSON.stringify(themeForm))
  const savedContentSnapshot = ref(JSON.stringify(contentForm))
  const savedSeoSnapshot = ref(JSON.stringify(seoForm))

  const isDirty = computed(() => JSON.stringify(siteLayoutForm) !== savedSiteLayoutSnapshot.value
    || JSON.stringify(themeForm) !== savedThemeSnapshot.value
    || JSON.stringify(contentForm) !== savedContentSnapshot.value
    || JSON.stringify(seoForm) !== savedSeoSnapshot.value
    || !!pendingLogoFile.value
    || !!pendingHeroBgFile.value
    || !!pendingAboutCoverFile.value
    || !!pendingFaviconFile.value
    || !!pendingOgImageFile.value,
  )

  watch(tenant, (t) => {
    if (!t) return
    Object.assign(siteLayoutForm, initSiteLayout(t))
    Object.assign(themeForm, initTheme(t))
    Object.assign(contentForm, initContent(t))
    Object.assign(seoForm, initSeo(t))
    updateSnapshots()
  })

  const onPendingHeroBg = (file: File | null) => {
    if (file) {
      if (pendingHeroBgFile.value && contentForm.hero.bgUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.hero.bgUrl)
      } else {
        originalHeroBgUrl = contentForm.hero.bgUrl
      }
      pendingHeroBgFile.value = file
      contentForm.hero.bgUrl = URL.createObjectURL(file)
    } else {
      if (contentForm.hero.bgUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.hero.bgUrl)
      }
      pendingHeroBgFile.value = null
      contentForm.hero.bgUrl = originalHeroBgUrl
      originalHeroBgUrl = null
    }
  }

  const onPendingAboutCover = (file: File | null) => {
    if (file) {
      if (pendingAboutCoverFile.value && contentForm.about.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.about.coverUrl)
      } else {
        originalAboutCoverUrl = contentForm.about.coverUrl
      }
      pendingAboutCoverFile.value = file
      contentForm.about.coverUrl = URL.createObjectURL(file)
    } else {
      if (contentForm.about.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.about.coverUrl)
      }
      pendingAboutCoverFile.value = null
      contentForm.about.coverUrl = originalAboutCoverUrl
      originalAboutCoverUrl = null
    }
  }

  const setPendingLogo = (file: File | null) => {
    pendingLogoFile.value = file
  }

  const setPendingFavicon = (file: File | null) => {
    pendingFaviconFile.value = file
  }

  const setPendingOgImage = (file: File | null) => {
    pendingOgImageFile.value = file
  }

  const uploadPendingAssets = async (tenantId: string) => {
    if (pendingLogoFile.value) {
      contentForm.logo = await db.tenants.uploadAsset(tenantId, pendingLogoFile.value, 'logo')
      pendingLogoFile.value = null
    }
    if (pendingHeroBgFile.value) {
      const url = await db.tenants.uploadAsset(tenantId, pendingHeroBgFile.value, 'hero-bg')

      if (contentForm.hero.bgUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.hero.bgUrl)
      }
      contentForm.hero.bgUrl = url
      pendingHeroBgFile.value = null
      originalHeroBgUrl = null
    }
    if (pendingAboutCoverFile.value) {
      const url = await db.tenants.uploadAsset(tenantId, pendingAboutCoverFile.value, 'about-cover')

      if (contentForm.about.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(contentForm.about.coverUrl)
      }
      contentForm.about.coverUrl = url
      pendingAboutCoverFile.value = null
      originalAboutCoverUrl = null
    }
    if (pendingFaviconFile.value) {
      seoForm.favicon = await db.tenants.uploadAsset(tenantId, pendingFaviconFile.value, 'favicon')
      pendingFaviconFile.value = null
    }
    if (pendingOgImageFile.value) {
      seoForm.ogImage = await db.tenants.uploadAsset(tenantId, pendingOgImageFile.value, 'og-image')
      pendingOgImageFile.value = null
    }
  }

  const updateSnapshots = () => {
    savedSiteLayoutSnapshot.value = JSON.stringify(siteLayoutForm)
    savedThemeSnapshot.value = JSON.stringify(themeForm)
    savedContentSnapshot.value = JSON.stringify(contentForm)
    savedSeoSnapshot.value = JSON.stringify(seoForm)
  }

  const saving = ref(false)
  const configIssues = ref<ConfigIssue[]>([])
  const dismissConfigIssues = () => {
    configIssues.value = []
  }

  const sanitizeSeo = (): TenantSeo => {
    const seo: TenantSeo = JSON.parse(JSON.stringify(seoForm))
    const errors: string[] = []

    const ga = seo.googleAnalyticsId?.trim() || null

    if (ga && !GA_ID_RE.test(ga)) {
      errors.push('Google Analytics ID — неверный формат, ожидается G-XXXXXXXXXX')
      seo.googleAnalyticsId = null
    } else {
      seo.googleAnalyticsId = ga ? ga.toUpperCase() : null
    }

    const ym = seo.yandexMetrikaId?.trim() || null

    if (ym && !YM_ID_RE.test(ym)) {
      errors.push('Яндекс.Метрика — неверный номер счётчика, ожидается число из 5–12 цифр')
      seo.yandexMetrikaId = null
    } else {
      seo.yandexMetrikaId = ym
    }

    if (errors.length) {
      showError(`Аналитика не сохранена: ${errors.join('; ')}`)
    }

    return seo
  }

  const save = async () => {
    saving.value = true
    try {
      await uploadPendingAssets(tenantStore.tenant.id)
      const seo = sanitizeSeo()

      const issues = validateTenantConfig(siteLayoutForm, tenantStore.tenant.modules, contentForm)
      const hasErrors = issues.some((i) => i.severity === 'error')

      if (hasErrors) {
        configIssues.value = issues

        return
      }

      await tenantStore.update({
        siteLayout: JSON.parse(JSON.stringify(siteLayoutForm)),
        theme: JSON.parse(JSON.stringify(themeForm)),
        siteContent: JSON.parse(JSON.stringify(contentForm)),
        seo,
      })
      updateSnapshots()
      configIssues.value = issues
      success(issues.length ? 'Сохранено (есть замечания)' : 'Сохранено')
    } catch (e) {
      showError('Не удалось сохранить. Попробуйте ещё раз')
      throw e
    } finally {
      saving.value = false
    }
  }

  return {
    siteLayoutForm,
    themeForm,
    contentForm,
    seoForm,
    pendingLogoFile,
    setPendingLogo,
    setPendingFavicon,
    setPendingOgImage,
    isDirty,
    saving,
    save,
    onPendingHeroBg,
    onPendingAboutCover,
    configIssues,
    dismissConfigIssues,
  }
}
