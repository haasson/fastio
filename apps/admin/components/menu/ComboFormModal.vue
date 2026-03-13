<template>
  <UiDrawer
    :model-value="modelValue"
    :title="combo ? 'Редактировать комбо' : 'Новое комбо'"
    :width="900"
    :actions="drawerActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
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
              placeholder="Комбо «Семейный обед»"
              :rules="[{ type: 'required', message: 'Введите название' }]"
            />
            <UiInputNumber
              v-model="form.price"
              name="price"
              label="Цена, ₽ *"
              :min="0"
              placeholder="990"
              :rules="[{ type: 'required', message: 'Введите цену' }]"
            />
          </div>

          <UiInput
            v-model="form.description"
            label="Описание"
            type="textarea"
            :rows="2"
            placeholder="Суп, горячее и напиток по выгодной цене"
          />

        </div>
      </div>

      <UiCollapse :expanded-names="['composition']" class="sections">
        <UiCollapseItem name="composition" title="Состав комбо">
          <UiSelect
            :value="form.dishIds"
            multiple
            filterable
            :options="dishOptions"
            placeholder="Выберите блюда"
            :loading="dishesLoading"
            @update:value="form.dishIds = $event as string[]"
          />
        </UiCollapseItem>

        <UiCollapseItem name="tags" title="Теги">
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

        <UiCollapseItem name="settings" title="Настройки">
          <UiCheckbox v-model="form.active">Активно</UiCheckbox>
        </UiCollapseItem>
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiInput, UiInputNumber, UiCheckbox, UiText, UiSelect, UiCollapse, UiCollapseItem } from '@fastio/ui'
import type { Combo, DishTag, Category } from '@fastio/shared'
import type { ComboFormData } from '@fastio/shared'
import { tagOptions } from '~/config/dish-tags'
import { useDatabase } from '~/composables/data/useDatabase'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  categories: Category[]
  combo: Combo | null
  addCombo: (data: ComboFormData) => Promise<Combo | null | void>
  updateCombo: (id: string, data: Partial<ComboFormData>) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()
const saving = ref(false)
const dishesLoading = ref(false)
const allDishes = ref<{ id: string; name: string; categoryId: string }[]>([])

const dishOptions = computed(() => {
  const byCategory = new Map<string, { label: string; value: string }[]>()

  for (const d of allDishes.value) {
    if (!byCategory.has(d.categoryId)) byCategory.set(d.categoryId, [])
    byCategory.get(d.categoryId)!.push({ label: d.name, value: d.id })
  }

  return props.categories
    .filter((c) => c.type === 'regular' && byCategory.has(c.id))
    .map((c) => ({
      type: 'group' as const,
      label: c.name,
      key: c.id,
      children: byCategory.get(c.id)!,
    }))
})

const loadDishes = async () => {
  if (!props.tenantId) return
  dishesLoading.value = true
  const dishes = await api.dishes.listAllActive(props.tenantId)

  allDishes.value = dishes.map((d) => ({ id: d.id, name: d.name, categoryId: d.categoryId }))
  dishesLoading.value = false
}

const photoKey = ref(0)
const originalPhotoUrl = ref<string | null>(null)
const currentPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)

const defaultForm = () => ({
  name: '',
  description: '',
  price: null as number | null,
  tags: [] as DishTag[],
  active: true,
  dishIds: [] as string[],
})

const form = reactive(defaultForm())
const formRef = ref()

const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const toggleTag = (tag: DishTag, value: boolean) => {
  form.tags = value ? [...form.tags, tag] : form.tags.filter((t) => t !== tag)
}

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return

    photoKey.value++
    pendingPhotoFile.value = null
    photoRemoved.value = false

    await loadDishes()

    if (props.combo) {
      originalPhotoUrl.value = props.combo.photos[0] ?? null
      currentPhotoUrl.value = props.combo.photos[0] ?? null
      form.name = props.combo.name
      form.description = props.combo.description
      form.price = props.combo.price
      form.tags = [...props.combo.tags]
      form.active = props.combo.active
      form.dishIds = await api.combos.getDishIds(props.combo.id)
    } else {
      originalPhotoUrl.value = null
      currentPhotoUrl.value = null
      Object.assign(form, defaultForm())
    }
  },
)

const onConfirm = async () => {
  const valid = await formRef.value?.validate?.()

  if (valid === false) return false

  saving.value = true

  try {
    let photos = props.combo?.photos ?? []

    if (pendingPhotoFile.value) {
      if (originalPhotoUrl.value) await api.combos.deletePhoto(originalPhotoUrl.value)
      photos = [await api.combos.uploadPhoto(props.tenantId, pendingPhotoFile.value)]
    } else if (photoRemoved.value && originalPhotoUrl.value) {
      await api.combos.deletePhoto(originalPhotoUrl.value)
      photos = []
    }

    const data: ComboFormData = {
      name: form.name,
      description: form.description,
      price: form.price ?? 0,
      photos,
      tags: form.tags,
      active: form.active,
      dishIds: form.dishIds,
    }

    if (props.combo) {
      await props.updateCombo(props.combo.id, data)
    } else {
      await props.addCombo(data)
    }

    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.top-grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 20px;
  align-items: start;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.col-photo,
.col-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.row {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;

  @media (min-width: 480px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
