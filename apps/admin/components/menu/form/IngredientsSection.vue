<template>
  <UiCollapseItem name="ingredients" title="Состав">
    <div class="ingredients-section-root">
      <div v-for="(ing, i) in ingredients" :key="i" class="row">
        <UiInput v-model="ing.name" placeholder="Ингредиент" :clearable="false" />
        <UiCheckbox v-model="ing.removable">Можно убрать</UiCheckbox>
        <UiButton size="tiny" type="text" @click="remove(i)">✕</UiButton>
      </div>
      <UiButton type="default" icon="plus" @click="add">Добавить ингредиент</UiButton>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { UiCollapseItem, UiInput, UiCheckbox, UiButton } from '@fastio/ui'
import type { DishIngredient } from '@fastio/shared'

const ingredients = reactive<DishIngredient[]>([])

const init = (items: DishIngredient[]) => ingredients.splice(0, ingredients.length, ...items.map((i) => ({ ...i })))

const add = () => ingredients.push({ name: '', removable: false })
const remove = (i: number) => ingredients.splice(i, 1)

defineExpose({ init, getIngredients: (): DishIngredient[] => [...ingredients] })
</script>

<style scoped lang="scss">
.ingredients-section-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
