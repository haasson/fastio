<template>
  <UiCollapseItem name="nutrition" title="Пищевая ценность">
    <div class="nutrition-section-root">
      <UiInputNumber
        v-model="state.weight"
        label="Вес, г"
        :min="0"
        placeholder="350"
      />
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

type NutritionState = {
  weight: number | null
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
}

const state = reactive<NutritionState>({ weight: null, calories: null, protein: null, fat: null, carbs: null })

const init = (nutrition: Partial<NutritionState> | null) => {
  state.weight = nutrition?.weight ?? null
  state.calories = nutrition?.calories ?? null
  state.protein = nutrition?.protein ?? null
  state.fat = nutrition?.fat ?? null
  state.carbs = nutrition?.carbs ?? null
}

const getNutrition = (): NutritionState | null => {
  const hasAny = Object.values(state).some((v) => v !== null && v !== 0)

  if (!hasAny) return null

  return {
    weight: state.weight ?? 0,
    calories: state.calories ?? 0,
    protein: state.protein ?? 0,
    fat: state.fat ?? 0,
    carbs: state.carbs ?? 0,
  }
}

defineExpose({ init, getNutrition })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.nutrition-section-root {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @include mq-m {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
