<template>
  <div class="nutrition-root" :class="`size-${size}`">
    <span>{{ nutrition.weight }} г</span>
    <span>{{ nutrition.calories }} ккал</span>
    <span>Б {{ nutrition.protein }}</span>
    <span>Ж {{ nutrition.fat }}</span>
    <span>У {{ nutrition.carbs }}</span>
  </div>
</template>

<script setup lang="ts">
type Nutrition = {
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

type Props = {
  nutrition: Nutrition
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Props>(), { size: 'sm' })
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.nutrition-root {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--color-text-secondary);

  span {
    white-space: nowrap;
  }
}

.size-sm {
  @include text-micro;
}

.size-md {
  @include text-xs;
}
</style>
