<template>
  <UiModal
    :model-value="modelValue"
    :title="isNew ? 'Новый стол' : (table?.name ?? 'Стол')"
    :width="480"
    :loading="saving"
    :actions="[
      { text: 'Отмена', type: 'default', actionType: 'decline' },
      { text: isNew ? 'Создать' : 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving },
    ]"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="edit-modal-root">
      <UiForm ref="formRef" class="form">
        <UiInput
          v-model="form.name"
          label="Название"
          name="name"
          placeholder="Например: Стол 1"
          :clearable="false"
          :rules="[{ type: 'required', message: 'Введите название стола' }]"
        />

        <UiInputNumber
          v-model:value="form.capacity"
          label="Вместимость"
          placeholder="Кол-во мест"
          :min="1"
          :max="100"
          :show-button="true"
        />

        <UiInput
          v-model="form.notes"
          label="Заметки"
          type="textarea"
          :rows="2"
          placeholder="Дополнительная информация"
        />

        <div class="field">
          <UiText size="small" class="field-label">Форма</UiText>
          <UiSegmentedControl
            :model-value="form.shape"
            :items="shapeOptions"
            size="small"
            @update:model-value="form.shape = $event as TableShape"
          />
        </div>

        <div class="toggle-row">
          <UiText size="small" class="toggle-label">Активен</UiText>
          <NSwitch :value="form.isActive" @update:value="form.isActive = $event" />
        </div>
      </UiForm>

      <div v-if="!isNew && !table?.isOpen" class="delete-section">
        <UiButton type="error" size="small" @click="handleDelete">
          Удалить стол
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { NSwitch } from 'naive-ui'
import { UiModal, UiForm, UiInput, UiInputNumber, UiButton, UiText, UiSegmentedControl } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Table, TableShape } from '@fastio/shared'

// Полезная нагрузка формы стола. Модалка — тупая: собирает значения и эмитит
// их наверх, сама в БД/audit не лезет. Создание/обновление/удаление и тосты —
// на родителе (list.vue). Так «Отмена» гарантированно ничего не пишет.
export type TableFormPayload = {
  name: string
  capacity: number | null
  notes: string | null
  shape: TableShape
  isActive: boolean
}

const props = defineProps<{
  modelValue: boolean
  table: Table | null
  isNew?: boolean
  defaultName?: string
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit': [payload: TableFormPayload]
  'delete': [id: string]
}>()

const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const { confirm } = useConfirm()

const shapeOptions = [
  { label: 'Прямоугольный', value: 'rectangle' },
  { label: 'Круглый', value: 'circle' },
]

const form = reactive({
  name: '',
  capacity: null as number | null,
  notes: '' as string | null,
  shape: 'rectangle' as TableShape,
  isActive: true,
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return

    if (props.table) {
      form.name = props.table.name
      form.capacity = props.table.capacity
      form.notes = props.table.notes ?? ''
      form.shape = props.table.shape
      form.isActive = props.table.isActive
    } else {
      // create-mode: чистый драфт, ничего не персистится до «Создать»
      form.name = props.defaultName ?? ''
      form.capacity = null
      form.notes = ''
      form.shape = 'rectangle'
      form.isActive = true
    }
  },
)

// Возвращаем false → UiModal остаётся открытой. Закрывает родитель после
// успешной персистентности (editModalOpen = false), поэтому при ошибке create
// форма не схлопывается и введённое не теряется.
const handleSave = (): boolean => {
  if (!formRef.value?.validate()) return false

  emit('submit', {
    name: form.name.trim(),
    capacity: form.capacity,
    notes: form.notes || null,
    shape: form.shape,
    isActive: form.isActive,
  })

  return false
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

  emit('delete', props.table.id)
}

</script>

<style scoped lang="scss">
.edit-modal-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.field-label {
  font-weight: var(--font-weight-medium);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) 0;
}

.toggle-label {
  font-weight: var(--font-weight-medium);
}

.delete-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>
