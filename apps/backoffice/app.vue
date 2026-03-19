<template>
  <NConfigProvider>
    <div class="app-root">
      <header class="app-header">
        <h1 class="app-title">Fastio Backoffice</h1>
        <NMenu
          mode="horizontal"
          :value="activeKey"
          :options="menuOptions"
          @update:value="handleNav"
        />
      </header>
      <NuxtPage />
    </div>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead, useRoute, useRouter } from '#imports'
import { NConfigProvider, NMenu } from 'naive-ui'

useHead({ link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }] })

const route = useRoute()
const router = useRouter()

const menuOptions = [
  { label: 'Тенанты', key: 'tenants' },
  { label: 'Тарифы', key: 'plans' },
]

const activeKey = computed(() => {
  if (route.path.startsWith('/plans')) return 'plans'

  return 'tenants'
})

const handleNav = (key: string) => {
  router.push(`/${key}`)
}
</script>

<style scoped>
.app-root {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 16px 32px;
  border-bottom: 1px solid #eee;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: #111;
  white-space: nowrap;
}
</style>
