<template>
  <UiDrawer
    :model-value="modelValue"
    :title="dish ? 'Редактировать блюдо' : 'Новое блюдо'"
    :width="900"
    :actions="drawerActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <!-- Фото + Основное -->
      <div class="top-grid">
        <div class="col-photo">
          <UiText size="tiny" span class="section-title">Фото</UiText>
          <PhotoUpload
            :key="photoKey"
            :model-value="currentPhotoUrl"
            @update:model-value="currentPhotoUrl = $event; photoRemoved = !$event"
            @pending="pendingPhotoFile = $event"
          />
        </div>

        <div class="col-main">
          <UiText size="tiny" span class="section-title">Основное</UiText>

          <div class="row">
            <UiInput
              v-model="form.name"
              name="name"
              label="Название *"
              placeholder="Маргарита"
              :rules="[{ type: 'required', message: 'Введите название' }]"
            />
            <UiInputNumber
              v-model="form.price"
              name="price"
              label="Цена, ₽ *"
              :min="0"
              placeholder="350"
              :rules="[{ type: 'required', message: 'Введите цену' }]"
            />
          </div>

          <UiInput
            v-model="form.description"
            label="Описание"
            type="textarea"
            :rows="2"
            placeholder="Томатный соус, моцарелла, базилик"
          />

          <UiSelect
            v-if="categories.length > 1"
            v-model:value="form.categoryId"
            label="Категория"
            :options="categoryOptions"
          />
        </div>
      </div>

      <UiCollapse :expanded-names="[]" class="sections">
        <!-- Теги -->
        <UiCollapseItem
          name="tags"
          title="Теги"
        >
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
        </UiCollapseItem>

        <!-- Модификаторы -->
        <DishModifiersSection
          ref="modifiersRef"
          :tenant-id="tenantId"
          :category-id="form.categoryId"
          :dish-id="dish?.id ?? null"
          :refresh-key="settingsRefreshKey"
        />

        <!-- Состав -->
        <UiCollapseItem
          name="ingredients"
          title="Состав"
        >
          <div class="ingredients-list">
            <div v-for="(ing, i) in form.ingredients" :key="i" class="ingredient-row">
              <UiInput v-model="ing.name" placeholder="Ингредиент" :clearable="false" />
              <UiCheckbox v-model="ing.removable">Можно убрать</UiCheckbox>
              <UiButton size="tiny" type="text" @click="removeIngredient(i)">✕</UiButton>
            </div>
            <UiButton type="default" icon="plus" @click="addIngredient">Добавить ингредиент</UiButton>
          </div>
        </UiCollapseItem>

        <!-- КБЖУ -->
        <UiCollapseItem
          name="nutrition"
          title="Пищевая ценность"
        >
          <div class="nutrition-grid">
            <UiInputNumber
              v-model="nutrition.weight"
              label="Вес, г"
              :min="0"
              placeholder="350"
            />
            <UiInputNumber
              v-model="nutrition.calories"
              label="Ккал"
              :min="0"
              placeholder="850"
            />
            <UiInputNumber
              v-model="nutrition.protein"
              label="Белки, г"
              :min="0"
              placeholder="38"
            />
            <UiInputNumber
              v-model="nutrition.fat"
              label="Жиры, г"
              :min="0"
              placeholder="32"
            />
            <UiInputNumber
              v-model="nutrition.carbs"
              label="Углеводы, г"
              :min="0"
              placeholder="86"
            />
          </div>
        </UiCollapseItem>

        <!-- Настройки -->
        <DishSettingsSection
          ref="settingsRef"
          :active="form.active"
          :dish-id="dish?.id ?? null"
          :price="form.price"
          :refresh-key="settingsRefreshKey"
          @update:active="form.active = $event"
        />
      </UiCollapse>

    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiInput, UiInputNumber, UiButton, UiCheckbox, UiText, UiSelect, UiCollapse, UiCollapseItem } from '@fastio/ui'
import type { Dish, DishTag, DishIngredient, Category } from '@fastio/shared'
import type { DishFormData } from '~/utils/api/dishes'
import { tagOptions } from '~/config/dish-tags'
import { useBranchStore } from '~/stores/branch'
import { useDishSave } from '~/composables/data/useDishSave'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'
import DishSettingsSection from '~/components/menu/DishSettingsSection.vue'
import DishModifiersSection from '~/components/menu/DishModifiersSection.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  categoryId: string
  categories: Category[]
  dish: Dish | null
  addDish: (data: DishFormData) => Promise<Dish | null | void>
  updateDish: (id: string, data: Partial<DishFormData>) => Promise<void>
}>()

const tenantIdRef = computed(() => props.tenantId)
const { uploadPhoto, deletePhoto, saveBranchPrices, saveDishModifiers } = useDishSave(tenantIdRef)
const branchStore = useBranchStore()
const branches = computed(() => branchStore.branches)

const settingsRef = ref<InstanceType<typeof DishSettingsSection> | null>(null)
const modifiersRef = ref<InstanceType<typeof DishModifiersSection> | null>(null)
const settingsRefreshKey = ref(0)

const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })),
)

const formRef = ref()
const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()
const saving = ref(false)

// Photo state
const photoKey = ref(0)
const originalPhotoUrl = ref<string | null>(null) // URL from saved dish, used for deletion
const currentPhotoUrl = ref<string | null>(null) // current display URL (null when user removes)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)

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
  () => props.modelValue,
  (val) => {
    if (val) {
      photoKey.value++
      originalPhotoUrl.value = props.dish?.photos[0] ?? null
      currentPhotoUrl.value = props.dish?.photos[0] ?? null
      pendingPhotoFile.value = null
      photoRemoved.value = false
      settingsRefreshKey.value++

      if (!props.dish) {
        Object.assign(form, defaultForm())
        Object.assign(nutrition, { weight: null, calories: null, protein: null, fat: null, carbs: null })
      }
    }
  },
)

watch(
  () => props.dish,
  (dish) => {
    originalPhotoUrl.value = dish?.photos[0] ?? null
    currentPhotoUrl.value = dish?.photos[0] ?? null
    pendingPhotoFile.value = null
    photoRemoved.value = false

    if (dish) {
      form.categoryId = dish.categoryId
      form.name = dish.name
      form.description = dish.description
      form.price = dish.price
      form.tags = [...dish.tags]
      form.active = dish.active
      form.order = dish.order
      form.ingredients = dish.ingredients.map((ing: DishIngredient) => ({ ...ing }))
      if (dish.nutrition) {
        Object.assign(nutrition, dish.nutrition)
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

const toggleTag = (value: DishTag, checked: boolean) => {
  if (checked) {
    if (!form.tags.includes(value)) form.tags.push(value)
  } else {
    form.tags = form.tags.filter((t) => t !== value)
  }
}

const addIngredient = () => {
  form.ingredients.push({ name: '', removable: false })
}

const removeIngredient = (index: number) => {
  form.ingredients.splice(index, 1)
}

const buildNutrition = () => {
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

const onConfirm = async () => {
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    let photos = currentPhotoUrl.value ? [currentPhotoUrl.value] : []

    if (pendingPhotoFile.value) {
      if (originalPhotoUrl.value) await deletePhoto(originalPhotoUrl.value)
      photos = [await uploadPhoto(pendingPhotoFile.value)]
    } else if (photoRemoved.value && originalPhotoUrl.value) {
      await deletePhoto(originalPhotoUrl.value)
      photos = []
    }

    const data: DishFormData = {
      ...form,
      price: form.price ?? 0,
      nutrition: buildNutrition(),
      photos,
    }

    if (props.dish) {
      await props.updateDish(props.dish.id, data)

      if (branches.value.length > 0) {
        await saveBranchPrices(props.dish.id, settingsRef.value?.getBranchPrices() ?? [])
      }

      await saveDishModifiers(props.dish.id, modifiersRef.value?.getModifiers() ?? [])
    } else {
      const newDish = await props.addDish(data)

      if (newDish) {
        const modifiers = modifiersRef.value?.getModifiers() ?? []

        if (modifiers.length > 0) await saveDishModifiers(newDish.id, modifiers)
      }
    }
    emit('saved')
  } catch {
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;
@use '@fastio/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  @include section-title;
  padding-top: 4px;
}

.sections {
  margin-top: 4px;
}

.top-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @include mq-m {
    grid-template-columns: 280px 1fr;
    gap: 24px;
  }
}

.col-photo,
.col-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

</style>
