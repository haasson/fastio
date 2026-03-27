<template>
  <UiCollapseItem name="ingredients" title="Ингредиенты">
    <template #header-extra>
      <HintPopover>
        <UiText size="tiny">
          Состав блюда. Гость может убрать любой ингредиент при заказе. Удобно скопировать с похожего блюда и подправить.
        </UiText>
      </HintPopover>
    </template>

    <div class="ingredients-section-root">
      <div v-for="(ing, i) in ingredients" :key="i" class="row">
        <UiInput v-model="ing.name" placeholder="Ингредиент" :clearable="false" />
        <UiButton size="tiny" type="text" @click="remove(i)">✕</UiButton>
      </div>

      <template v-if="!addMode">
        <div class="add-buttons">
          <UiButton
            type="primary"
            size="small"
            icon="plus"
            @click="add"
          >Добавить</UiButton>
          <UiButton
            v-if="hasCopySource"
            type="default"
            size="small"
            @click="addMode = 'copy'"
          >
            Скопировать с другого блюда
          </UiButton>
        </div>
      </template>

      <div v-if="addMode === 'copy'" class="add-section">
        <UiSelect
          v-model:value="copyFromDishId"
          label=""
          placeholder="Выберите блюдо"
          :options="copyDishSelectOptions"
          class="add-select"
        />
        <UiButton type="default" :disabled="!copyFromDishId" @click="copyFromDish">
          Скопировать
        </UiButton>
        <UiButton type="text" size="tiny" @click="addMode = null">✕</UiButton>
      </div>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { UiCollapseItem, UiInput, UiButton, UiText, UiSelect } from '@fastio/ui'
import type { DishIngredient } from '@fastio/shared'
import HintPopover from '~/components/ui/HintPopover.vue'

const props = defineProps<{
  categoryDishes: Array<{ id: string; name: string; ingredients: DishIngredient[] }>
}>()

const ingredients = reactive<DishIngredient[]>([])

const addMode = ref<'copy' | null>(null)
const copyFromDishId = ref<string | null>(null)

const copySourceDishes = computed(() => props.categoryDishes.filter((d) => d.ingredients.length > 0),
)

const copyDishSelectOptions = computed(() => copySourceDishes.value.map((d) => ({ label: d.name, value: d.id })),
)

const hasCopySource = computed(() => copyDishSelectOptions.value.length > 0)

const copyFromDish = () => {
  const dish = props.categoryDishes.find((d) => d.id === copyFromDishId.value)

  if (!dish) return
  ingredients.splice(0, ingredients.length, ...dish.ingredients.map((i) => ({ ...i })))
  copyFromDishId.value = null
  addMode.value = null
}

const init = (items: DishIngredient[]) => ingredients.splice(0, ingredients.length, ...items.map((i) => ({ ...i })))

const add = () => ingredients.push({ name: '' })
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

.add-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-select {
  width: 300px;
}
</style>
