<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastfood-saas/shared'
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

<style>
:root {
  --primary: #ff6b35;
  --primary-light: color-mix(in srgb, var(--primary) 12%, white);
  --primary-dark: color-mix(in srgb, var(--primary) 80%, black);
}

body {
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
}
</style>
