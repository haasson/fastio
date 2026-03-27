<template>
  <TabsLayout :tabs="tabs" base-path="/menu" />
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useTenantStore } from '~/stores/tenant'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useModules } from '~/composables/plan/useModules'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const { canManageMenu } = usePermissions()
const modules = useModules()

const tabs = computed(() => [
  { value: 'dishes', label: 'Блюда' },
  ...(canManageMenu.value ? [{ value: 'categories', label: 'Категории' }] : []),
  ...(canManageMenu.value && modules.modifiers.value.enabled ? [{ value: 'modifiers', label: 'Модификаторы' }] : []),
  ...(canManageMenu.value && modules.addons.value.enabled ? [{ value: 'addons', label: 'Добавки' }] : []),
  ...(canManageMenu.value ? [{ value: 'tags', label: 'Теги' }] : []),
])

const route = useRoute()
const router = useRouter()

// Если активный таб исчез (модуль отключили) — редирект на блюда
watch(tabs, (newTabs) => {
  const seg = route.path.split('/').at(-1) ?? ''

  if (!newTabs.some((t) => t.value === seg)) {
    router.replace('/menu/dishes')
  }
})
</script>
