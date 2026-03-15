<template>
  <div class="app-root" :style="themeStyle">
    <NuxtPage />
    <div class="theme-dev-panel">
      <select class="theme-dev-select" :value="currentTheme.name" @change="e => setTheme((e.target as HTMLSelectElement).value)">
        <option v-for="t in themes" :key="t.name" :value="t.name">{{ t.label }}</option>
      </select>
      <button class="theme-dev-random" @click="randomize" title="Случайная тема">🎲</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastio/shared'
import { paletteToCssVars } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import useTheme from '~/composables/useTheme'
import { isGoogleFontValue, fontFamilyCSS, googleFontUrl } from '~/utils/google-fonts'

// Восстанавливаем корзину из localStorage
const cartStore = useCartStore()
onMounted(() => cartStore.restore())

// Применяем тему тенанта как CSS-переменные
const route = useRoute()
const rfetch = useRequestFetch()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
const { data: tenant } = await useAsyncData<Tenant>('tenant', () => rfetch('/api/tenant', slugQuery))

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

useHead({
  titleTemplate: (title) => title ? `${title} — ${tenant.value?.name ?? ''}` : (tenant.value?.name ?? ''),
  meta: [
    { name: 'description', content: `Заказать еду онлайн — ${tenant.value?.name}` },
  ],
  link: googleFontLink,
})

const tenantOverrides = computed(() => {
  const t = tenant.value?.theme
  if (!t) return {}
  const fontVar = t.fontFamily ? { '--font-family': fontFamilyCSS(t.fontFamily) } : {}
  const headingFontVar = t.headingFontFamily ? { '--heading-font-family': fontFamilyCSS(t.headingFontFamily) } : {}
  if (t.palette) {
    return { ...paletteToCssVars(t.palette), ...fontVar, ...headingFontVar }
  }
  // Fallback для старых данных без palette
  const result: Record<string, string> = {}
  if (t.primaryColor) result['--primary'] = t.primaryColor
  return { ...result, ...fontVar, ...headingFontVar }
})

const { currentTheme, themes, themeStyle, randomize, setTheme } = useTheme(tenantOverrides)

watch(() => tenant.value?.theme?.preset, preset => {
  if (preset) setTheme(preset)
}, { immediate: true })
</script>

<style lang="scss">
.app-root {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  transition: background 0.3s, color 0.3s;
}

.theme-dev-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  border-radius: 999px;
  padding: 6px 6px 6px 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}

.theme-dev-select {
  background: none;
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;

  option { background: #1a1a1a; color: #fff; }
}

.theme-dev-random {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover { background: rgba(255,255,255,0.25); }
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary: #ff6b35;
  --primary-light: color-mix(in srgb, var(--primary) 12%, white);
  --primary-dark: color-mix(in srgb, var(--primary) 80%, black);

  /* Light theme */
  --color-bg: #ffffff;
  --color-surface: #f5f5f5;
  --color-text: #111111;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;
  --color-border: #e0e0e0;
}

[data-theme="dark"] {
  --color-bg: #2d1208;
  --color-surface: #3d1a0e;
  --color-text: #f5ede8;
  --color-text-secondary: #c4a090;
  --color-text-muted: #8a6055;
  --color-border: #4d2418;
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

ul, ol {
  list-style: none;
}
</style>
