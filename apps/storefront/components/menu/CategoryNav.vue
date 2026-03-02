<template>
  <nav class="nav-root" ref="navRef">
    <div class="inner">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-btn"
        :class="{ active: activeCategoryId === cat.id }"
        @click="$emit('select', cat.id)"
      >
        {{ cat.name }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { Category } from '@fastfood-saas/shared'

defineProps<{
  categories: Category[]
  activeCategoryId: string | null
}>()

defineEmits<{ select: [id: string] }>()
</script>

<style scoped lang="scss">
.nav-root {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 69px;
  z-index: 90;
}

.inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.cat-btn {
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #888;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover {
    color: #333;
  }

  &.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
}
</style>
