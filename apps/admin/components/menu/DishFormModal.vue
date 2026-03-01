<template>
  <AppModal
    :model-value="modelValue"
    :title="dish ? 'Редактировать блюдо' : 'Новое блюдо'"
    width="560px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="form" @submit.prevent="handleSubmit">
      <!-- Основное -->
      <div class="section-title">Основное</div>

      <div class="row">
        <div class="field">
          <label class="label">Название *</label>
          <input v-model="form.name" class="input" type="text" placeholder="Маргарита" required />
        </div>
        <div class="field field-sm">
          <label class="label">Цена, ₽ *</label>
          <input v-model.number="form.price" class="input" type="number" min="0" placeholder="350" required />
        </div>
      </div>

      <div class="field">
        <label class="label">Описание</label>
        <textarea v-model="form.description" class="textarea" rows="2" placeholder="Томатный соус, моцарелла, базилик" />
      </div>

      <!-- Теги -->
      <div class="section-title">Теги</div>
      <div class="tags-grid">
        <label v-for="(label, value) in tagOptions" :key="value" class="tag-option">
          <input v-model="form.tags" type="checkbox" :value="value" />
          <span>{{ label }}</span>
        </label>
      </div>

      <!-- Состав -->
      <div class="section-title">Состав</div>
      <div class="ingredients-list">
        <div v-for="(ing, i) in form.ingredients" :key="i" class="ingredient-row">
          <input v-model="ing.name" class="input" type="text" placeholder="Ингредиент" />
          <label class="checkbox-label">
            <input v-model="ing.removable" type="checkbox" />
            <span>Убрать</span>
          </label>
          <button type="button" class="remove-btn" @click="removeIngredient(i)">✕</button>
        </div>
        <button type="button" class="btn-ghost" @click="addIngredient">+ Добавить ингредиент</button>
      </div>

      <!-- КБЖУ -->
      <div class="section-title">Пищевая ценность <span class="optional">(необязательно)</span></div>
      <div class="nutrition-grid">
        <div class="field">
          <label class="label">Вес, г</label>
          <input v-model.number="nutrition.weight" class="input" type="number" min="0" placeholder="350" />
        </div>
        <div class="field">
          <label class="label">Ккал</label>
          <input v-model.number="nutrition.calories" class="input" type="number" min="0" placeholder="850" />
        </div>
        <div class="field">
          <label class="label">Белки, г</label>
          <input v-model.number="nutrition.protein" class="input" type="number" min="0" placeholder="38" />
        </div>
        <div class="field">
          <label class="label">Жиры, г</label>
          <input v-model.number="nutrition.fat" class="input" type="number" min="0" placeholder="32" />
        </div>
        <div class="field">
          <label class="label">Углеводы, г</label>
          <input v-model.number="nutrition.carbs" class="input" type="number" min="0" placeholder="86" />
        </div>
      </div>

      <!-- Активность -->
      <div class="active-row">
        <span class="label">Показывать в меню</span>
        <AppToggle v-model="form.active" />
      </div>

      <div class="form-footer">
        <button type="button" class="btn-secondary" @click="$emit('update:modelValue', false)">Отмена</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

<script setup lang="ts">
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

const { add, update } = useDishes(props.tenantId, ref(props.categoryId))
const saving = ref(false)

const tagOptions: Record<DishTag, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегетарианское',
  vegan: '🌱 Веганское',
  new: '🆕 Новинка',
  popular: '⭐ Популярное',
  hit: '🔥 Хит продаж',
}

const defaultForm = (): Omit<DishFormData, 'nutrition'> => ({
  categoryId: props.categoryId,
  name: '',
  description: '',
  price: 0,
  ingredients: [],
  tags: [],
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

// Заполняем форму при открытии / смене блюда
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

<style scoped>
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
  grid-template-columns: 1fr 120px;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.input,
.textarea {
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: #111;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}

.input {
  height: 40px;
}

.textarea {
  padding: 10px 12px;
  resize: vertical;
}

.input:focus,
.textarea:focus {
  border-color: #ff6b35;
}

/* Теги */
.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #444;
  cursor: pointer;
}

/* Состав */
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

.ingredient-row .input {
  flex: 1;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  cursor: pointer;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #bbb;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #ffeaea;
  color: #e53935;
}

.btn-ghost {
  background: transparent;
  border: 1.5px dashed #ddd;
  border-radius: 8px;
  height: 36px;
  font-size: 13px;
  color: #999;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-ghost:hover {
  border-color: #ff6b35;
  color: #ff6b35;
}

/* КБЖУ */
.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

/* Активность */
.active-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid #f0f0f0;
}

/* Footer */
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f0f0f0;
}

.btn-primary,
.btn-secondary {
  height: 38px;
  padding: 0 18px;
  border-radius: 9px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary {
  background: #ff6b35;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #e55a25;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f0f0f0;
  color: #555;
}

.btn-secondary:hover {
  background: #e5e5e5;
}

@media (max-width: 480px) {
  .nutrition-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .row {
    grid-template-columns: 1fr;
  }
}
</style>
