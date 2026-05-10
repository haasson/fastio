<template>
  <TabsLayout :tabs="tabs" base-path="/menu" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useGate } from '~/composables/plan/useGate'
import { useTenantStore } from '~/shared/stores/tenant'
import { useTerms } from '~/features/legal'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

const gate = useGate()
const tenantStore = useTenantStore()
const { item, menu } = useTerms()

usePageTitle(menu.label)

const tabs = computed(() => [
  { value: 'dishes', label: item.plural.label, attrs: { 'data-tour': 'menu-tab-dishes' } },
  ...(gate.manageMenu.value.enabled ? [{ value: 'categories', label: 'Категории', attrs: { 'data-tour': 'menu-tab-categories' } }] : []),
  ...(!tenantStore.isServices && gate.manageMenu.value.enabled && gate.modifiers.value.enabled ? [{ value: 'modifiers', label: 'Модификаторы', attrs: { 'data-tour': 'menu-tab-modifiers' } }] : []),
  ...(!tenantStore.isServices && gate.manageMenu.value.enabled && gate.addons.value.enabled ? [{ value: 'addons', label: 'Добавки', attrs: { 'data-tour': 'menu-tab-addons' } }] : []),
  ...(gate.manageMenu.value.enabled ? [{ value: 'tags', label: 'Теги', attrs: { 'data-tour': 'menu-tab-tags' } }] : []),
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
