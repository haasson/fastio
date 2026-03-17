<template>
  <nav class="category-bar-root">
    <SfScrollNav
      :items="navItems"
      :model-value="activeId"
      :overflow="overflow"
      @update:model-value="onSelect"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Category } from '@fastio/shared'
import SfScrollNav from '~/components/sf/nav/SfScrollNav.vue'

type MenuData = {
  categories: Category[]
  dishes: unknown[]
  dishModifiers: Record<string, unknown[]>
}

defineProps<{
  overflow: 'scroll' | 'wrap'
}>()

const { data: menu } = useNuxtData<MenuData>('menu')

const activeId = ref<string | number | undefined>(undefined)

const navItems = computed(() => {
  return (menu.value?.categories ?? []).map((cat) => ({
    id: cat.id,
    label: cat.name,
  }))
})

const onSelect = (id: string | number) => {
  activeId.value = id
  if (import.meta.client) {
    const el = document.getElementById(`category-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.category-bar-root {
  background: var(--color-surface);
  padding: 0;
}
</style>
