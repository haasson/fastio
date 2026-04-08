<template>
  <div class="app-root">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <FsToastProvider :toasts="toasts" :on-dismiss="dismiss as (id: string | number) => void" />
      <AuthLoginModal />
      <AuthRegisterModal />
      <AuthForgotPasswordModal />
      <ConfirmDialog />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute, useAsyncData, useHead, useRequestFetch } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { paletteToCssVars } from '@fastio/shared'
import { useAuthStore } from '~/stores/auth'
import AuthLoginModal from '~/components/auth/AuthLoginModal.vue'
import AuthRegisterModal from '~/components/auth/AuthRegisterModal.vue'
import AuthForgotPasswordModal from '~/components/auth/AuthForgotPasswordModal.vue'
import useTheme from '~/composables/useTheme'
import { isGoogleFontValue, fontFamilyCSS, googleFontUrl } from '~/utils/google-fonts'
import { FsToastProvider } from '@fastio/public-ui'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { useAnalytics } from '~/composables/useAnalytics'
import { useCartReconciler } from '~/composables/useCartReconciler'

const { toasts, dismiss } = useToast()

const authStore = useAuthStore()
onMounted(() => {
  authStore.init()
})

useCartReconciler()

// Применяем тему тенанта как CSS-переменные
const route = useRoute()
const rfetch = useRequestFetch()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
// @ts-expect-error Nuxt router type causes excessive stack depth with useAsyncData options
const [{ data: tenant }] = await Promise.all([
  useAsyncData<Tenant>('tenant', () => rfetch('/api/tenant', slugQuery)),
  useAsyncData('menu', () => rfetch('/api/menu', slugQuery)),
])

const googleFontLink = computed(() => {
  const theme = tenant.value?.theme
  if (!theme) return []
  const links = []
  if (theme.fontFamily && isGoogleFontValue(theme.fontFamily))
    links.push({ rel: 'stylesheet', href: googleFontUrl(theme.fontFamily) })
  if (theme.headingFontFamily && isGoogleFontValue(theme.headingFontFamily) && theme.headingFontFamily !== theme.fontFamily)
    links.push({ rel: 'stylesheet', href: googleFontUrl(theme.headingFontFamily) })
  return links
})

const faviconLink = computed(() => {
  const favicon = tenant.value?.seo?.favicon
  if (!favicon) return []
  return [
    { rel: 'icon', type: 'image/png', href: favicon, key: 'favicon' },
    { rel: 'apple-touch-icon', href: favicon },
  ]
})

useAnalytics(() => tenant.value?.seo)

useHead(computed(() => {
  const t = tenant.value
  const seo = t?.seo
  const title = seo?.metaTitle || t?.name || ''
  const description = seo?.metaDescription || ''
  const ogImage = seo?.ogImage || t?.siteContent?.logo || ''

  return {
    titleTemplate: (pageTitle) => pageTitle ? `${pageTitle} — ${title}` : title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: seo?.robots === 'noindex' ? 'noindex,nofollow' : 'index,follow' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      { property: 'og:type', content: 'website' },
    ],
    link: [...googleFontLink.value, ...faviconLink.value],
  }
}))

const RADIUS_MAP: Record<string, string> = { square: '4px', rounded: '8px', pill: '9999px' }
const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  subtle: '0 2px 8px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.04)',
  medium: '0 4px 16px rgba(0, 0, 0, 0.10), 0 2px 4px rgba(0, 0, 0, 0.06)',
}

const tenantOverrides = computed(() => {
  const t = tenant.value?.theme
  if (!t) return {}
  const fontVar = t.fontFamily ? { '--font-family': fontFamilyCSS(t.fontFamily) } : {}
  const headingFontVar = t.headingFontFamily ? { '--heading-font-family': fontFamilyCSS(t.headingFontFamily) } : {}
  const shapeVars = {
    '--radius-btn': RADIUS_MAP[t.buttonRadius] ?? '8px',
    '--radius-card': `${t.cardRadius ?? 14}px`,
    '--shadow-card': SHADOW_MAP[t.cardShadow] ?? SHADOW_MAP.subtle,
    '--shadow-card-md': t.cardShadow === 'none' ? 'none' : SHADOW_MAP.medium,
  }
  if (t.palette) {
    return { ...paletteToCssVars(t.palette), ...fontVar, ...headingFontVar, ...shapeVars }
  }
  // Fallback для старых данных без palette
  const result: Record<string, string> = {}
  if (t.primaryColor) result['--primary'] = t.primaryColor
  return { ...result, ...fontVar, ...headingFontVar, ...shapeVars }
})

const { themeStyle, setTheme } = useTheme(tenantOverrides)

watch(() => tenant.value?.theme?.preset, preset => {
  if (preset) setTheme(preset)
}, { immediate: true })

useHead(computed(() => ({
  // :root:root — specificity 0,2,0 vs дефолтов из _tokens.scss (:root = 0,1,0).
  // Гарантированно перекрывает дефолты без зависимости от порядка тегов в <head>.
  // Работает для всех элементов включая портальный контент вне .app-root.
  style: [{ innerHTML: `:root:root{${themeStyle.value}}`, id: 'tenant-theme', tagPriority: 'high' }],
})))
</script>

<style lang="scss">
.app-root {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  transition: background 0.3s, color 0.3s;
}

:root {
  --z-sticky: 100;
  --z-mobile-menu: 200;
  --z-header: 300;
  --header-height: 56px;

  @media (min-width: 768px) {
    --header-height: 64px;
  }
}


*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  -webkit-font-smoothing: antialiased;
}

.app-root {
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--heading-font-family, var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif));
  }
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font: inherit;
}

img, svg {
  display: block;
  max-width: 100%;
}

/* Yandex Maps инжектит SVG которые ломаются от глобального max-width: 100% */
.__ymap svg {
  max-width: none;
}

ul, ol {
  list-style: none;
}
</style>
