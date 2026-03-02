<template>
  <nav class="breadcrumbs-root">
    <ul class="list">
      <li
        v-for="(item, index) in visibleItems"
        :key="index"
        class="item"
      >
        <span v-if="!item.link" class="text">{{ item.label }}</span>
        <span v-else class="text link" @click="handleClick(item)">{{ item.label }}</span>
        <span v-if="index < visibleItems.length - 1" class="separator" />
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import useBreakpoints from '../composables/useBreakpoints'

export type BreadcrumbItem = {
  label: string
  link?: string
}

type Props = {
  items: BreadcrumbItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  route: [item: BreadcrumbItem]
}>()

const { sOnly } = useBreakpoints()

const MAX_ITEMS_SMALL = 2

const visibleItems = computed(() => {
  if (sOnly.value && props.items.length > MAX_ITEMS_SMALL) {
    return props.items.slice(-MAX_ITEMS_SMALL)
  }

  return props.items
})

const handleClick = (item: BreadcrumbItem) => {
  if (item.link) {
    emit('route', item)
  }
}
</script>

<style scoped lang="scss">
@use '../styles/mixins/typography' as *;

.list {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
}

.text {
  @include secondary-font(14);
  color: var(--color-text);
}

.link {
  color: var(--color-primary);
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
}

.separator {
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
}
</style>
