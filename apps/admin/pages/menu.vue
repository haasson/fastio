<template>
  <TabsLayout :tabs="tabs" base-path="/menu" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from '#imports'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useAccess } from '~/composables/plan/useAccess'
import { useTerms } from '~/composables/useTerms'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

const { canManageMenu } = usePermissions()
const access = useAccess()
const terms = useTerms()
const { item, menu } = terms

usePageTitle(menu.label)

const tabs = computed(() => [
  { value: 'dishes', label: item.plural.label, attrs: { 'data-tour': 'menu-tab-dishes' } },
  ...(canManageMenu.value ? [{ value: 'categories', label: 'Категории', attrs: { 'data-tour': 'menu-tab-categories' } }] : []),
  ...(!access.isServices.value && canManageMenu.value && access.modifiers.value ? [{ value: 'modifiers', label: 'Модификаторы', attrs: { 'data-tour': 'menu-tab-modifiers' } }] : []),
  ...(!access.isServices.value && canManageMenu.value && access.addons.value ? [{ value: 'addons', label: 'Добавки', attrs: { 'data-tour': 'menu-tab-addons' } }] : []),
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
