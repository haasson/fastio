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
      <UiAlert v-if="visibilityIssues.length > 0" type="warning">
        Комбо скрыто в меню по следующим причинам:
        <ul class="issues-list">
          <li v-for="issue in visibilityIssues" :key="issue">{{ issue }}</li>
        </ul>
      </UiAlert>

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
        @update:name="form.name = $event ?? ''"
        @update:price="form.price = $event"
        @update:description="form.description = $event ?? ''"
      />

      <UiCollapse :expanded-names="['composition']" class="sections">
        <ComboCompositionSection
          v-model="form.items"
          :tenant-id="tenantId"
          :categories="categories"
          :refresh-key="refreshKey"
          :combo-price="form.price"
        />

        <TagsSection v-model="form.tags" :available-tags="tags" />

        <SettingsSection
          entity="combo"
          :active="form.active"
          :branch-ids="form.branchIds"
          :branch-options="tenantStore.tenant.modules.branches ? branchOptions : []"
          @update:active="form.active = $event"
          @update:branch-ids="form.branchIds = $event"
        />
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiCollapse, UiAlert } from '@fastio/ui'
import type { Combo, Category, ComboItemInput, DishTagDefinition } from '@fastio/shared'
import type { ComboFormData } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useBranchStore } from '~/shared/stores/branch'
import { useTenantStore } from '~/shared/stores/tenant'
import BasicInfoSection from '~/features/catalog/components/form/BasicInfoSection.vue'
import ComboCompositionSection from './form/ComboCompositionSection.vue'
import TagsSection from '~/features/catalog/components/form/TagsSection.vue'
import SettingsSection from './form/SettingsSection.vue'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  categories: Category[]
  combo: Combo | null
  tags: DishTagDefinition[]
  addCombo: (data: ComboFormData) => Promise<Combo | null | void>
  updateCombo: (id: string, data: Partial<ComboFormData>) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))
const saving = ref(false)
const refreshKey = ref(0)
const visibilityIssues = ref<string[]>([])
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
  tags: [] as string[],
  active: true,
  items: [] as ComboItemInput[],
  branchIds: [] as string[],
})

const form = reactive(defaultForm())
let loadId = 0

watch(
  () => props.modelValue,
  async (val) => {
    if (!val) return
    const currentLoadId = ++loadId

    refreshKey.value++
    pendingPhotoFile.value = null
    photoRemoved.value = false

    if (props.combo) {
      originalPhotoUrl.value = props.combo.photos[0] ?? null
      currentPhotoUrl.value = props.combo.photos[0] ?? null
      form.name = props.combo.name
      form.description = props.combo.description
      form.price = props.combo.price

      const [tags, items, issues] = await Promise.all([
        api.tags.getComboTagIds(props.combo.id),
        api.combos.getItems(props.combo.id),
        api.combos.getComboVisibilityIssues(props.combo.id),
      ])

      if (currentLoadId !== loadId) return
      form.tags = tags
      form.active = props.combo.active
      form.items = items
      form.branchIds = [...(props.combo.branchIds ?? [])]
      visibilityIssues.value = issues
    } else {
      originalPhotoUrl.value = null
      currentPhotoUrl.value = null
      visibilityIssues.value = []
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
      branchIds: form.branchIds,
    }

    if (props.combo) {
      await props.updateCombo(props.combo.id, data)
      await api.tags.setComboTags(props.combo.id, props.tenantId, form.tags)
    } else {
      const created = await props.addCombo(data)

      if (created) {
        await api.tags.setComboTags(created.id, props.tenantId, form.tags)
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
  gap: var(--space-20);
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.issues-list {
  margin: var(--space-8) 0 0;
  padding-left: var(--space-16);
  list-style-type: disc;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
