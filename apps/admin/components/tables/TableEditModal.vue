<template>
  <UiModal
    :model-value="modelValue"
    :title="table?.name ?? 'Стол'"
    :width="480"
    :loading="saving"
    :actions="[
      { text: 'Отмена', type: 'default', actionType: 'decline' },
      { text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving },
    ]"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="edit-modal-root">
      <div class="form">
        <UiInput
          v-model="form.name"
          label="Название"
          placeholder="Например: Стол 1"
          :clearable="false"
        />

        <UiInputNumber
          v-model:value="form.capacity"
          label="Вместимость"
          placeholder="Кол-во мест"
          :min="1"
          :max="100"
        />

        <UiInput
          v-model="form.notes"
          label="Заметки"
          placeholder="Дополнительная информация"
        />

        <div class="toggle-row">
          <UiText size="small" class="toggle-label">Активен</UiText>
          <NSwitch :value="form.isActive" @update:value="form.isActive = $event" />
        </div>
      </div>

      <div v-if="!isNew" class="delete-section">
        <UiButton type="error" size="small" @click="handleDelete">
          Удалить стол
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { NSwitch } from 'naive-ui'
import { UiModal, UiInput, UiInputNumber, UiButton, UiText, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Table } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  modelValue: boolean
  table: Table | null
  isNew?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'updated': [table: Table]
  'deleted': [id: string]
}>()

const api = useDatabase()
const { success, warning } = useMessage()
const { confirm } = useConfirm()

const saving = ref(false)

const form = reactive({
  name: '',
  capacity: null as number | null,
  notes: '' as string | null,
  isActive: true,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.table) {
      form.name = props.table.name
      form.capacity = props.table.capacity
      form.notes = props.table.notes ?? ''
      form.isActive = props.table.isActive
    }
  },
)

const handleSave = async () => {
  if (!props.table) return

  const trimmedName = form.name.trim()

  if (!trimmedName) {
    warning('Введите название стола')

    return false
  }

  saving.value = true
  try {
    const [updated] = await Promise.all([
      api.tables.updateMeta(props.table.id, {
        name: trimmedName,
        capacity: form.capacity,
        notes: form.notes || null,
      }),
      form.isActive !== props.table.isActive
        ? api.tables.setActive(props.table.id, form.isActive)
        : null,
    ])

    if (updated) {
      emit('updated', { ...updated, isActive: form.isActive })
      success('Стол обновлён')
    }

    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!props.table) return

  const ok = await confirm({
    title: 'Удалить стол?',
    message: `«${props.table.name}» будет деактивирован. История заказов сохранится.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

  await api.tables.archive(props.table.id)
  emit('deleted', props.table.id)
  emit('update:modelValue', false)
  success('Стол удалён')
}

</script>

<style scoped lang="scss">
.edit-modal-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.toggle-label {
  font-weight: 500;
}

.delete-section {
  display: flex;
  justify-content: center;
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
}
</style>
