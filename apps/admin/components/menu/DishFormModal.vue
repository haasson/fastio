<template>
  <UiModal
    :model-value="modelValue"
    :title="dish ? 'Редактировать блюдо' : 'Новое блюдо'"
    :width="560"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="form" @submit.prevent="handleSubmit">
      <!-- Основное -->
      <div class="section-title">Основное</div>

      <div class="row">
        <UiInput v-model="form.name" label="Название *" placeholder="Маргарита" />
        <UiInputNumber v-model="form.price" label="Цена, ₽ *" :min="0" placeholder="350" />
      </div>

      <UiInput v-model="form.description" label="Описание" type="textarea" :rows="2" placeholder="Томатный соус, моцарелла, базилик" />

      <!-- Теги -->
      <div class="section-title">Теги</div>
      <div class="tags-grid">
        <UiCheckbox
          v-for="(label, value) in tagOptions"
          :key="value"
          :model-value="form.tags.includes(String(value) as DishTag)"
          @update:model-value="toggleTag(String(value) as DishTag, $event)"
        >
          {{ label }}
        </UiCheckbox>
      </div>

      <!-- Состав -->
      <div class="section-title">Состав</div>
      <div class="ingredients-list">
        <div v-for="(ing, i) in form.ingredients" :key="i" class="ingredient-row">
          <UiInput v-model="ing.name" placeholder="Ингредиент" :clearable="false" />
          <UiCheckbox v-model="ing.removable">Убрать</UiCheckbox>
          <UiButton size="tiny" type="text" @click="removeIngredient(i)">✕</UiButton>
        </div>
        <UiButton type="tertiary" @click="addIngredient">+ Добавить ингредиент</UiButton>
      </div>

      <!-- КБЖУ -->
      <div class="section-title">
        Пищевая ценность <span class="optional">(необязательно)</span>
      </div>
      <div class="nutrition-grid">
        <UiInputNumber v-model="nutrition.weight" label="Вес, г" :min="0" placeholder="350" />
        <UiInputNumber v-model="nutrition.calories" label="Ккал" :min="0" placeholder="850" />
        <UiInputNumber v-model="nutrition.protein" label="Белки, г" :min="0" placeholder="38" />
        <UiInputNumber v-model="nutrition.fat" label="Жиры, г" :min="0" placeholder="32" />
        <UiInputNumber v-model="nutrition.carbs" label="Углеводы, г" :min="0" placeholder="86" />
      </div>

      <!-- Активность -->
      <div class="active-row">
        <span class="label">Показывать в меню</span>
        <!-- TODO: заменить на UiSwitch когда добавят в @fastfood-saas/ui -->
        <UiAppToggle v-model="form.active" />
      </div>

      <div class="form-footer">
        <UiButton type="tertiary" @click="$emit('update:modelValue', false)">Отмена</UiButton>
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </form>
  </UiModal>
</template>

<script setup lang="ts">
import { UiModal, UiInput, UiInputNumber, UiButton, UiCheckbox } from '@fastfood-saas/ui'
import type { Dish, DishTag, DishIngredient } from '@fastfood-saas/shared'
import type { DishFormData } from '~/composables/useDishes'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  categoryId: string
  dish: Dish | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { add, update } = useDishes(toRef(props, 'tenantId'), toRef(props, 'categoryId'))
const saving = ref(false)

const tagOptions: Record<DishTag, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегетарианское',
  vegan: '🌱 Веганское',
  new: '🆕 Новинка',
  popular: '⭐ Популярное',
  hit: '🔥 Хит продаж',
}

const defaultForm = () => ({
  categoryId: props.categoryId,
  name: '',
  description: '',
  price: null as number | null,
  ingredients: [] as DishIngredient[],
  tags: [] as DishTag[],
  active: true,
  order: 0,
})

const form = reactive(defaultForm())

const nutrition = reactive({
  weight: null as number | null,
  calories: null as number | null,
  protein: null as number | null,
  fat: null as number | null,
  carbs: null as number | null,
})

watch(
  () => props.dish,
  (d) => {
    if (d) {
      form.name = d.name
      form.description = d.description
      form.price = d.price
      form.tags = [...d.tags]
      form.active = d.active
      form.order = d.order
      form.ingredients = d.ingredients.map((i: DishIngredient) => ({ ...i }))
      if (d.nutrition) {
        Object.assign(nutrition, d.nutrition)
      } else {
        Object.assign(nutrition, { weight: null, calories: null, protein: null, fat: null, carbs: null })
      }
    } else {
      Object.assign(form, defaultForm())
      Object.assign(nutrition, { weight: null, calories: null, protein: null, fat: null, carbs: null })
    }
  },
  { immediate: true },
)

function toggleTag(value: DishTag, checked: boolean) {
  if (checked) {
    if (!form.tags.includes(value)) form.tags.push(value)
  } else {
    form.tags = form.tags.filter((t) => t !== value)
  }
}

function addIngredient() {
  form.ingredients.push({ name: '', removable: false })
}

function removeIngredient(index: number) {
  form.ingredients.splice(index, 1)
}

function buildNutrition() {
  const hasAny = Object.values(nutrition).some((v) => v !== null && v !== 0)
  if (!hasAny) return null
  return {
    weight: nutrition.weight ?? 0,
    calories: nutrition.calories ?? 0,
    protein: nutrition.protein ?? 0,
    fat: nutrition.fat ?? 0,
    carbs: nutrition.carbs ?? 0,
  }
}

async function handleSubmit() {
  saving.value = true
  try {
    const data: DishFormData = {
      ...form,
      price: form.price ?? 0,
      categoryId: props.categoryId,
      nutrition: buildNutrition(),
    }

    if (props.dish) {
      await update(props.dish.id, data)
    } else {
      await add(data)
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastfood-saas/ui/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
  padding-top: 4px;
}

.optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;

  @include mq-m {
    grid-template-columns: 1fr 120px;
  }
}

.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ingredients-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredient-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @include mq-m {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.active-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid #f0f0f0;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f0f0f0;
}
</style>
