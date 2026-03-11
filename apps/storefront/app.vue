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
const { data: tenant } = await useAsyncData<Tenant>('tenant', () => $fetch('/api/tenant'))

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
