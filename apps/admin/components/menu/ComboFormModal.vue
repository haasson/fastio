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
      <BasicInfoSection
        :photo-url="currentPhotoUrl"
        :name="form.name"
        :price="form.price"
        :description="form.description"
        name-placeholder="Комбо «Семейный обед»"
        :price-placeholder="990"
        description-placeholder="Суп, горячее и напиток по выгодной цене"
        @update:photo-url="currentPhotoUrl = $event"
        @update:photo-removed="photoRemoved = $event"
        @update:pending-photo="pendingPhotoFile = $event"
        @update:name="form.name = $event"
        @update:price="form.price = $event"
        @update:description="form.description = $event"
      />

      <UiCollapse :expanded-names="['composition']" class="sections">
        <ComboCompositionSection
          v-model="form.items"
          :tenant-id="tenantId"
          :categories="categories"
          :refresh-key="refreshKey"
          :combo-price="form.price"
        />

        <TagsSection v-model="form.tags" />

        <SettingsSection
          ref="settingsRef"
          entity="combo"
          :active="form.active"
          :entity-id="combo?.id ?? null"
          :price="form.price"
          :refresh-key="refreshKey"
          @update:active="form.active = $event"
        />
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiCollapse } from '@fastio/ui'
import type { Combo, DishTag, Category, ComboItemInput } from '@fastio/shared'
import type { ComboFormData } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import BasicInfoSection from '~/components/menu/form/BasicInfoSection.vue'
import ComboCompositionSection from '~/components/menu/form/ComboCompositionSection.vue'
import TagsSection from '~/components/menu/form/TagsSection.vue'
import SettingsSection from '~/components/menu/form/SettingsSection.vue'

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
const refreshKey = ref(0)
const settingsRef = ref<InstanceType<typeof SettingsSection> | null>(null)
const formRef = ref()

const originalPhotoUrl = ref<string | null>(null)
const currentPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)

const drawerActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const defaultForm = () => ({
  name: '',
  description: '',
  price: null as number | null,
  tags: [] as DishTag[],
  active: true,
  items: [] as ComboItemInput[],
})

const form = reactive(defaultForm())

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return

    refreshKey.value++
    pendingPhotoFile.value = null
    photoRemoved.value = false

    if (props.combo) {
      originalPhotoUrl.value = props.combo.photos[0] ?? null
      currentPhotoUrl.value = props.combo.photos[0] ?? null
      form.name = props.combo.name
      form.description = props.combo.description
      form.price = props.combo.price
      form.tags = [...props.combo.tags]
      form.active = props.combo.active
      form.items = await api.combos.getItems(props.combo.id)
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
      items: form.items,
    }

    if (props.combo) {
      await props.updateCombo(props.combo.id, data)
      await api.combos.setBranchSettings(props.combo.id, settingsRef.value?.getSettings() ?? [])
    } else {
      const created = await props.addCombo(data)

      if (created && typeof created === 'object' && 'id' in created) {
        await api.combos.setBranchSettings((created as { id: string }).id, settingsRef.value?.getSettings() ?? [])
      }
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

.sections {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
