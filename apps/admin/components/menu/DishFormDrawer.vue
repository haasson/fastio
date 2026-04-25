<template>
  <UiDrawer
    :model-value="modelValue"
    :title="modalTitle"
    :width="900"
    :actions="drawerActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <BasicInfoSection
        :photo-url="currentPhotoUrl"
        :name="form.name"
        :price="form.price"
        :description="form.description"
        :weight="form.weight"
        :weight-unit="form.weightUnit"
        :category-id="form.categoryId"
        :category-options="categoryOptions"
        :name-placeholder="terms.isServices ? 'Например: Ремонт холодильника' : 'Маргарита'"
        :price-placeholder="350"
        :description-placeholder="terms.isServices ? 'Опишите услугу' : 'Томатный соус, моцарелла, базилик'"
        :show-weight="isFood"
        @update:photo-url="currentPhotoUrl = $event"
        @update:photo-removed="photoRemoved = $event"
        @update:pending-photo="pendingPhotoFile = $event"
        @update:name="form.name = $event ?? ''"
        @update:price="form.price = $event"
        @update:description="form.description = $event ?? ''"
        @update:category-id="form.categoryId = String($event ?? '')"
        @update:weight="form.weight = $event"
        @update:weight-unit="form.weightUnit = $event"
        :long-description="form.longDescription"
        :show-long-description="form.showLongDescription"
        @update:long-description="form.longDescription = $event ?? ''"
        @update:show-long-description="form.showLongDescription = $event"
      />

      <UiCollapse :expanded-names="[]" class="sections" data-tour="dish-sections">
        <TagsSection v-model="form.tags" :available-tags="tags" />

        <DishModifiersSection
          v-if="modules.modifiers.value.enabled"
          ref="modifiersRef"
          :tenant-id="tenantId"
          :category-id="form.categoryId"
          :dish-id="dish?.id ?? null"
          :refresh-key="refreshKey"
          :weight-unit="form.weightUnit"
        />

        <AddonsSection
          v-if="!terms.isServices && modules.addons.value.enabled"
          ref="addonsRef"
          :tenant-id="tenantId"
          :dish-id="dish?.id ?? null"
          :refresh-key="refreshKey"
          :all-addons="allAddons"
          :presets="presets"
          :loading="addonsLoading"
          :category-dishes="categoryDishes"
          :max-addons-default="tenantStore.tenant.maxAddonsDefault ?? null"
          :initial-max-addons="dish?.maxAddons ?? null"
        />

        <IngredientsSection
          v-if="access.ingredients.value"
          ref="ingredientsRef"
          :category-dishes="categoryDishes"
        />

        <NutritionSection v-if="isFood" ref="nutritionRef" />

        <SettingsSection
          entity="dish"
          :active="form.active"
          :requires-kitchen="form.requiresKitchen"
          :entity-id="dish?.id ?? null"
          :refresh-key="refreshKey"
          @update:active="form.active = $event"
          @update:requires-kitchen="form.requiresKitchen = $event"
        />
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, toRefs, watch } from 'vue'
import { UiDrawer, UiForm, UiCollapse } from '@fastio/ui'
import type { Dish, Category, DishTagDefinition, DishIngredient } from '@fastio/shared'
import type { DishFormData } from '~/utils/api/dishes'
import { useDatabase } from '~/composables/data/useDatabase'
import { useBranchStore } from '~/stores/branch'
import { useTenantStore } from '~/stores/tenant'
import { useTerms } from '~/composables/useTerms'
import { useAccess } from '~/composables/plan/useAccess'
import { useDishSave } from '~/composables/data/useDishSave'
import { useAddons } from '~/composables/data/useAddons'
import { useModules } from '~/composables/plan/useModules'
import BasicInfoSection from '~/components/menu/form/BasicInfoSection.vue'
import TagsSection from '~/components/menu/form/TagsSection.vue'
import DishModifiersSection from '~/components/menu/form/DishModifiersSection.vue'
import AddonsSection from '~/components/menu/form/AddonsSection.vue'
import IngredientsSection from '~/components/menu/form/IngredientsSection.vue'
import NutritionSection from '~/components/menu/form/NutritionSection.vue'
import SettingsSection from '~/components/menu/form/SettingsSection.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  categoryId: string
  categories: Category[]
  dish: Dish | null
  tags: DishTagDefinition[]
  addDish?: (data: DishFormData) => Promise<Dish | null | void>
  updateDish: (id: string, data: Partial<DishFormData>) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const { tenantId: tenantIdRef } = toRefs(props)
const tenantStore = useTenantStore()
const terms = useTerms()
const { item } = terms
const isFood = computed(() => !terms.isServices && terms.menuStyle === 'food')
const modules = useModules()
const access = useAccess()
const modalTitle = computed(() => props.dish
  ? `Редактировать ${item.acc}`
  : `${item.new} ${item.nom}`)
const db = useDatabase()
const { uploadPhoto, deletePhoto, saveDishModifiers, saveDishAddons } = useDishSave(tenantIdRef)
const branchStore = useBranchStore()
const { addons: allAddons, loading: addonsLoading, presets, loadPresets } = useAddons(tenantIdRef)
const branches = computed(() => branchStore.branches)

const formRef = ref()
const modifiersRef = ref<InstanceType<typeof DishModifiersSection> | null>(null)
const addonsRef = ref<InstanceType<typeof AddonsSection> | null>(null)
const ingredientsRef = ref<InstanceType<typeof IngredientsSection> | null>(null)
const nutritionRef = ref<InstanceType<typeof NutritionSection> | null>(null)
const refreshKey = ref(0)
const saving = ref(false)
const categoryDishes = ref<Array<{ id: string; name: string; ingredients: DishIngredient[] }>>([])

const originalPhotoUrl = ref<string | null>(null)
const currentPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)

const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))

const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value, attrs: { 'data-tour': 'dish-save' } },
])

const defaultForm = () => ({
  categoryId: props.categoryId,
  name: '',
  description: '',
  price: null as number | null,
  weight: null as number | null,
  weightUnit: 'г' as 'г' | 'мл',
  tags: [] as string[],
  active: true,
  requiresKitchen: true,
  order: 0,
  longDescription: '',
  showLongDescription: false,
})

const form = reactive(defaultForm())

watch(
  () => props.dish,
  (dish) => {
    if (dish) {
      form.categoryId = dish.categoryId
      form.name = dish.name
      form.description = dish.description
      form.price = dish.price
      form.weight = dish.nutrition?.weight ?? null
      form.weightUnit = dish.weightUnit ?? 'г'
      form.tags = [...dish.tags]
      form.active = dish.active
      form.requiresKitchen = dish.requiresKitchen
      form.order = dish.order
      form.longDescription = dish.longDescription ?? ''
      form.showLongDescription = !!dish.longDescription
    } else {
      Object.assign(form, defaultForm())
    }
  },
  { immediate: true },
)

let loadId = 0

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return
    const currentLoadId = ++loadId

    refreshKey.value++
    originalPhotoUrl.value = props.dish?.photos[0] ?? null
    currentPhotoUrl.value = props.dish?.photos[0] ?? null
    pendingPhotoFile.value = null
    photoRemoved.value = false

    ingredientsRef.value?.init(props.dish?.ingredients ?? [])
    nutritionRef.value?.init(props.dish?.nutrition ?? null)

    if (props.dish) {
      const tags = await db.tags.getAssignedTagIds(props.dish.id)

      if (currentLoadId !== loadId) return
      form.tags = tags
    } else {
      Object.assign(form, defaultForm())
    }

    await loadPresets()
  },
)

watch(
  () => [props.modelValue, form.categoryId] as const,
  async ([open]) => {
    if (!open) return
    const dishes = await db.dishes.list(props.tenantId, form.categoryId)

    categoryDishes.value = dishes
      .filter((d) => d.id !== props.dish?.id)
      .map((d) => ({ id: d.id, name: d.name, ingredients: d.ingredients }))
  },
  { immediate: true },
)

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

    const kbju = nutritionRef.value?.getKbju() ?? null
    const hasNutrition = form.weight != null || kbju != null
    const maxAddons = addonsRef.value?.getMaxAddons()
    const { showLongDescription, ...formData } = form
    const data: DishFormData = {
      ...formData,
      price: form.price ?? 0,
      longDescription: showLongDescription && form.longDescription ? form.longDescription : null,
      ingredients: ingredientsRef.value?.getIngredients() ?? [],
      nutrition: hasNutrition ? { weight: form.weight ?? 0, calories: kbju?.calories ?? 0, protein: kbju?.protein ?? 0, fat: kbju?.fat ?? 0, carbs: kbju?.carbs ?? 0 } : null,
      weightUnit: form.weightUnit,
      maxAddons: maxAddons !== undefined ? maxAddons : null,
      photos,
    }

    if (props.dish) {
      await props.updateDish(props.dish.id, data)
      await db.tags.setDishTags(props.dish.id, props.tenantId, form.tags)
      await saveDishModifiers(props.dish.id, modifiersRef.value?.getModifiers() ?? [])
      await saveDishAddons(props.dish.id, addonsRef.value?.getAddonIds() ?? [])
    } else if (props.addDish) {
      const newDish = await props.addDish(data)

      if (newDish) {
        await db.tags.setDishTags(newDish.id, props.tenantId, form.tags)

        const modifiers = modifiersRef.value?.getModifiers() ?? []

        if (modifiers.length > 0) await saveDishModifiers(newDish.id, modifiers)

        const addonIds = addonsRef.value?.getAddonIds() ?? []

        if (addonIds.length > 0) await saveDishAddons(newDish.id, addonIds)
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
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.sections {
  margin-top: var(--space-4);
}
</style>
