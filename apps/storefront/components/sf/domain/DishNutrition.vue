<template>
  <div class="nutrition-root" :class="`size-${size}`">
    <span class="weight">{{ nutrition.weight }} {{ weightUnit }}</span>
    <FsTooltip v-if="hasBju" :content="bjuTooltip" side="top">
      <CircleHelp class="hint-icon" />
    </FsTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CircleHelp } from 'lucide-vue-next'
import { FsTooltip } from '@fastio/public-ui'

type Nutrition = {
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

type Props = {
  nutrition: Nutrition
  weightUnit?: 'г' | 'мл'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), { size: 'sm', weightUnit: 'г' })

const hasBju = computed(() =>
  props.nutrition.calories > 0 || props.nutrition.protein > 0 || props.nutrition.fat > 0 || props.nutrition.carbs > 0,
)

const bjuTooltip = computed(() => {
  const w = props.nutrition.weight
  if (!w) return ''
  const k = 100 / w
  const cal = Math.round(props.nutrition.calories * k)
  const p = Math.round(props.nutrition.protein * k)
  const f = Math.round(props.nutrition.fat * k)
  const c = Math.round(props.nutrition.carbs * k)
  return `На 100 ${props.weightUnit}: ${cal} ккал • Б ${p} • Ж ${f} • У ${c}`
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.nutrition-root {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
}

.size-sm {
  @include text-micro;
}

.size-md {
  @include text-xs;
}

.hint-icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  cursor: default;
}
</style>
