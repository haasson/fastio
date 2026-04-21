<template>
  <TabsLayout :tabs="tabs" base-path="/menu" />
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useTenantStore } from '~/stores/tenant'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useModules } from '~/composables/plan/useModules'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const { canManageMenu } = usePermissions()
const modules = useModules()
const { isServices, itemsLabel, menuLabel } = useTenantLabels()

usePageTitle(menuLabel)

const tabs = computed(() => [
  { value: 'dishes', label: itemsLabel.value, attrs: { 'data-tour': 'menu-tab-dishes' } },
  ...(canManageMenu.value ? [{ value: 'categories', label: 'Категории', attrs: { 'data-tour': 'menu-tab-categories' } }] : []),
  ...(!isServices.value && canManageMenu.value && modules.modifiers.value.enabled ? [{ value: 'modifiers', label: 'Модификаторы', attrs: { 'data-tour': 'menu-tab-modifiers' } }] : []),
  ...(!isServices.value && canManageMenu.value && modules.addons.value.enabled ? [{ value: 'addons', label: 'Добавки', attrs: { 'data-tour': 'menu-tab-addons' } }] : []),
  ...(canManageMenu.value ? [{ value: 'tags', label: 'Теги', attrs: { 'data-tour': 'menu-tab-tags' } }] : []),
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
