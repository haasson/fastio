<template>
  <UiCollapseItem name="nutrition" title="Пищевая ценность">
    <div class="nutrition-section-root">
      <UiInputNumber
        v-model="state.calories"
        label="Ккал"
        :min="0"
        placeholder="850"
      />
      <UiInputNumber
        v-model="state.protein"
        label="Белки, г"
        :min="0"
        placeholder="38"
      />
      <UiInputNumber
        v-model="state.fat"
        label="Жиры, г"
        :min="0"
        placeholder="32"
      />
      <UiInputNumber
        v-model="state.carbs"
        label="Углеводы, г"
        :min="0"
        placeholder="86"
      />
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { UiCollapseItem, UiInputNumber } from '@fastio/ui'

type KbjuState = {
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
}

const state = reactive<KbjuState>({ calories: null, protein: null, fat: null, carbs: null })

const init = (nutrition: Partial<KbjuState> | null) => {
  state.calories = nutrition?.calories ?? null
  state.protein = nutrition?.protein ?? null
  state.fat = nutrition?.fat ?? null
  state.carbs = nutrition?.carbs ?? null
}

const getKbju = (): KbjuState | null => {
  const hasAny = state.calories !== null || state.protein !== null || state.fat !== null || state.carbs !== null

  if (!hasAny) return null

  return {
    calories: state.calories ?? 0,
    protein: state.protein ?? 0,
    fat: state.fat ?? 0,
    carbs: state.carbs ?? 0,
  }
}

defineExpose({ init, getKbju })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.nutrition-section-root {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-8);

  @include mq-m {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
