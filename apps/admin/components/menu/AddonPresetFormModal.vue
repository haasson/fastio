<template>
  <UiModal
    :model-value="modelValue"
    :title="preset ? 'Изменить пресет' : 'Новый пресет'"
    :width="480"
    :actions="actions"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название"
        placeholder="Острый набор"
        :rules="[{ required: true, message: 'Введите название' }]"
      />

      <div class="checkboxes-label">
        <UiText size="small" color="secondary">Добавки в пресете</UiText>
        <UiText v-if="addonsError" size="small" style="color: var(--color-error)">{{ addonsError }}</UiText>
      </div>
      <div class="checkboxes">
        <UiCheckbox
          v-for="addon in addons"
          :key="addon.id"
          :model-value="form.addonIds.includes(addon.id)"
          @update:model-value="toggleAddon(addon.id, $event)"
        >
          {{ addon.name }} · {{ addon.price }} ₽
        </UiCheckbox>
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiText, UiCheckbox } from '@fastio/ui'
import type { Addon, AddonPreset } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  preset: AddonPreset | null
  addons: Addon[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()

const formRef = ref()
const saving = ref(false)
const addonsError = ref('')

const form = ref({
  name: '',
  addonIds: [] as string[],
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = props.preset
        ? { name: props.preset.name, addonIds: [...props.preset.addonIds] }
        : { name: '', addonIds: [] }
      addonsError.value = ''
    }
  },
)

const actions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const toggleAddon = (addonId: string, checked: boolean) => {
  if (checked) {
    form.value.addonIds.push(addonId)
  } else {
    form.value.addonIds = form.value.addonIds.filter((id) => id !== addonId)
  }
}

const handleSave = async () => {
  form.value.name = form.value.name.trim()
  addonsError.value = form.value.addonIds.length === 0 ? 'Выберите хотя бы одну добавку' : ''
  if (!formRef.value?.validate() || addonsError.value) return false

  saving.value = true
  try {
    if (props.preset) {
      await api.addons.updatePreset(props.preset.id, form.value.name, form.value.addonIds)
    } else {
      await api.addons.addPreset(props.tenantId, form.value.name, form.value.addonIds)
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch {
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  @include modal-form;
}

.checkboxes-label {
  margin-bottom: -8px;
}

.checkboxes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
}
</style>
