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
      <BasicInfoSection
        :photo-url="currentPhotoUrl"
        :name="form.name"
        :price="form.price"
        :description="form.description"
        :category-id="form.categoryId"
        :category-options="categoryOptions"
        name-placeholder="Маргарита"
        :price-placeholder="350"
        description-placeholder="Томатный соус, моцарелла, базилик"
        @update:photo-url="currentPhotoUrl = $event"
        @update:photo-removed="photoRemoved = $event"
        @update:pending-photo="pendingPhotoFile = $event"
        @update:name="form.name = $event"
        @update:price="form.price = $event"
        @update:description="form.description = $event"
        @update:category-id="form.categoryId = $event"
      />

      <UiCollapse :expanded-names="[]" class="sections">
        <TagsSection v-model="form.tags" />

        <DishModifiersSection
          ref="modifiersRef"
          :tenant-id="tenantId"
          :category-id="form.categoryId"
          :dish-id="dish?.id ?? null"
          :refresh-key="refreshKey"
        />

        <AddonsSection
          ref="addonsRef"
          :tenant-id="tenantId"
          :dish-id="dish?.id ?? null"
          :refresh-key="refreshKey"
          :all-addons="allAddons"
          :presets="presets"
          :loading="addonsLoading"
        />

        <IngredientsSection ref="ingredientsRef" />

        <NutritionSection ref="nutritionRef" />

        <SettingsSection
          ref="settingsRef"
          entity="dish"
          :active="form.active"
          :entity-id="dish?.id ?? null"
          :price="form.price"
          :refresh-key="refreshKey"
          @update:active="form.active = $event"
        />
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, toRefs, watch } from 'vue'
import { UiDrawer, UiForm, UiCollapse } from '@fastio/ui'
import type { Dish, DishTag, Category } from '@fastio/shared'
import type { DishFormData } from '~/utils/api/dishes'
import { useBranchStore } from '~/stores/branch'
import { useDishSave } from '~/composables/data/useDishSave'
import { useAddons } from '~/composables/data/useAddons'
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
  addDish?: (data: DishFormData) => Promise<Dish | null | void>
  updateDish: (id: string, data: Partial<DishFormData>) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const { tenantId: tenantIdRef } = toRefs(props)
const { uploadPhoto, deletePhoto, saveBranchPrices, saveDishModifiers, saveDishAddons } = useDishSave(tenantIdRef)
const branchStore = useBranchStore()
const { addons: allAddons, loading: addonsLoading, presets, loadPresets } = useAddons(tenantIdRef)
const branches = computed(() => branchStore.branches)

const formRef = ref()
const settingsRef = ref<InstanceType<typeof SettingsSection> | null>(null)
const modifiersRef = ref<InstanceType<typeof DishModifiersSection> | null>(null)
const addonsRef = ref<InstanceType<typeof AddonsSection> | null>(null)
const ingredientsRef = ref<InstanceType<typeof IngredientsSection> | null>(null)
const nutritionRef = ref<InstanceType<typeof NutritionSection> | null>(null)
const refreshKey = ref(0)
const saving = ref(false)

const originalPhotoUrl = ref<string | null>(null)
const currentPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)

const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))

const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const defaultForm = () => ({
  categoryId: props.categoryId,
  name: '',
  description: '',
  price: null as number | null,
  tags: [] as DishTag[],
  active: true,
  order: 0,
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
      form.tags = [...dish.tags]
      form.active = dish.active
      form.order = dish.order
    } else {
      Object.assign(form, defaultForm())
    }
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return

    refreshKey.value++
    originalPhotoUrl.value = props.dish?.photos[0] ?? null
    currentPhotoUrl.value = props.dish?.photos[0] ?? null
    pendingPhotoFile.value = null
    photoRemoved.value = false

    ingredientsRef.value?.init(props.dish?.ingredients ?? [])
    nutritionRef.value?.init(props.dish?.nutrition ?? null)

    if (!props.dish) Object.assign(form, defaultForm())

    await loadPresets()
  },
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

    const data: DishFormData = {
      ...form,
      price: form.price ?? 0,
      ingredients: ingredientsRef.value?.getIngredients() ?? [],
      nutrition: nutritionRef.value?.getNutrition() ?? null,
      photos,
    }

    if (props.dish) {
      await props.updateDish(props.dish.id, data)
      await saveBranchPrices(props.dish.id, (settingsRef.value?.getSettings() ?? []).map((s) => ({ ...s, dishId: props.dish!.id })))
      await saveDishModifiers(props.dish.id, modifiersRef.value?.getModifiers() ?? [])
      await saveDishAddons(props.dish.id, addonsRef.value?.getAddonIds() ?? [])
    } else if (props.addDish) {
      const newDish = await props.addDish(data)

      if (newDish) {
        const branchPrices = (settingsRef.value?.getSettings() ?? []).map((s) => ({ ...s, dishId: newDish.id }))

        if (branchPrices.length > 0) await saveBranchPrices(newDish.id, branchPrices)

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
  gap: 14px;
}

.sections {
  margin-top: 4px;
}
</style>
