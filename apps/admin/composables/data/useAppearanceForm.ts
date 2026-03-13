import { reactive, ref, computed, watch } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { Tenant, SiteLayout, SiteContent } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, defaultTheme, deepMerge, getPresetPalette } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
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

export type AppearanceFormContext = ReturnType<typeof useAppearanceForm>
export const AppearanceFormKey: InjectionKey<AppearanceFormContext> = Symbol('appearance:form')

export const useAppearanceForm = (tenant: Ref<Tenant | null>) => {
  const db = useDatabase()
  const tenantStore = useTenantStore()
  const { success, error: showError } = useMessage()

  const siteLayoutForm = reactive(initSiteLayout(tenant.value))
  const themeForm = reactive(initTheme(tenant.value))
  const contentForm = reactive(initContent(tenant.value))

  const pendingLogoFile = ref<File | null>(null)
  const pendingHeroBgFile = ref<File | null>(null)
  const pendingBannerFiles = ref<Map<string, File>>(new Map())
  let originalHeroBgUrl: string | null = null

  const savedSiteLayoutSnapshot = ref(JSON.stringify(siteLayoutForm))
  const savedThemeSnapshot = ref(JSON.stringify(themeForm))
  const savedContentSnapshot = ref(JSON.stringify(contentForm))

  const isDirty = computed(() => JSON.stringify(siteLayoutForm) !== savedSiteLayoutSnapshot.value
    || JSON.stringify(themeForm) !== savedThemeSnapshot.value
    || JSON.stringify(contentForm) !== savedContentSnapshot.value
    || !!pendingLogoFile.value
    || !!pendingHeroBgFile.value
    || pendingBannerFiles.value.size > 0,
  )

  watch(tenant, (t) => {
    if (!t) return
    Object.assign(siteLayoutForm, initSiteLayout(t))
    Object.assign(themeForm, initTheme(t))
    Object.assign(contentForm, initContent(t))
    updateSnapshots()
  })

  const onPendingBanners = (files: { blobUrl: string; file: File }[]) => {
    pendingBannerFiles.value = new Map(files.map((f) => [f.blobUrl, f.file]))
  }

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

  const setPendingLogo = (file: File | null) => {
    pendingLogoFile.value = file
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
    if (pendingBannerFiles.value.size > 0) {
      const items = contentForm.banners

      for (let i = 0; i < items.length; i++) {
        const blobUrl = items[i].url

        if (!blobUrl.startsWith('blob:')) continue
        const file = pendingBannerFiles.value.get(blobUrl)

        if (!file) continue
        const realUrl = await db.tenants.uploadAsset(tenantId, file, `banner-${i}`)

        URL.revokeObjectURL(blobUrl)
        items[i].url = realUrl
      }
      pendingBannerFiles.value.clear()
    }
  }

  const updateSnapshots = () => {
    savedSiteLayoutSnapshot.value = JSON.stringify(siteLayoutForm)
    savedThemeSnapshot.value = JSON.stringify(themeForm)
    savedContentSnapshot.value = JSON.stringify(contentForm)
  }

  const saving = ref(false)

  const save = async () => {
    if (!tenantStore.tenant) return
    saving.value = true
    try {
      await uploadPendingAssets(tenantStore.tenant.id)
      await tenantStore.update({
        siteLayout: JSON.parse(JSON.stringify(siteLayoutForm)),
        theme: JSON.parse(JSON.stringify(themeForm)),
        siteContent: JSON.parse(JSON.stringify(contentForm)),
      })
      updateSnapshots()
      success('Сохранено')
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
    pendingLogoFile,
    setPendingLogo,
    isDirty,
    saving,
    save,
    onPendingHeroBg,
    onPendingBanners,
  }
}
