<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

// Восстанавливаем корзину из localStorage
const cartStore = useCartStore()
onMounted(() => cartStore.restore())

// Применяем тему тенанта как CSS-переменные
const route = useRoute()
const rfetch = useRequestFetch()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
const { data: tenant } = await useAsyncData<Tenant>('tenant', () => rfetch('/api/tenant', slugQuery))

useHead({
  titleTemplate: (title) => title ? `${title} — ${tenant.value?.name ?? ''}` : (tenant.value?.name ?? ''),
  meta: [
    { name: 'description', content: `Заказать еду онлайн — ${tenant.value?.name}` },
  ],
})

const themeStyle = computed(() => {
  const t = tenant.value?.theme
  if (!t) return ''
  return [
    `--primary: ${t.primaryColor};`,
    `--font-family: ${t.fontFamily};`,
  ].join(' ')
})
</script>

<style lang="scss">
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
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  -webkit-font-smoothing: antialiased;
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
