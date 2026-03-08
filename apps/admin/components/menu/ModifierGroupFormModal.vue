<template>
  <UiModal
    :model-value="modelValue"
    :title="group ? 'Редактировать модификатор' : 'Новый модификатор'"
    :width="560"
    :actions="modalActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название группы *"
        placeholder="Размер, Диаметр, Бортик..."
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />

      <div class="switch-row">
        <UiSwitch v-model="form.active" label="Активна" />
      </div>

      <div class="options-section">
        <UiText size="tiny" span class="section-title">Опции *</UiText>

        <VueDraggable
          v-model="form.options"
          class="options-list"
          handle=".drag-handle"
          :animation="180"
        >
          <div v-for="(opt, i) in form.options" :key="opt.id ?? i" class="option-row">
            <UiIcon name="grip" class="drag-handle" />
            <UiInput
              v-model="opt.name"
              :placeholder="`Опция ${i + 1}`"
              :clearable="false"
              name="option"
              :rules="[{ type: 'required', message: 'Введите название' }]"
            />
            <UiButton size="tiny" type="text" @click="removeOption(i)">
              ✕
            </UiButton>
          </div>
        </VueDraggable>

        <UiAlert v-if="optionsError" type="error" size="small">
          {{ optionsError }}
        </UiAlert>

        <UiButton type="default" icon="plus" @click="addOption">
          Добавить опцию
        </UiButton>
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiModal, UiForm, UiInput, UiButton, UiSwitch, UiText, UiIcon, UiAlert } from '@fastio/ui'
import type { ModifierGroup, ModifierGroupFormData } from '@fastio/shared'

const props = defineProps<{
  modelValue: boolean
  group: ModifierGroup | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: ModifierGroupFormData]
}>()

const formRef = ref()
const saving = ref(false)
const optionsError = ref<string | null>(null)

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

type OptionForm = { id?: string; name: string; active: boolean }

const defaultForm = () => ({
  name: '',
  active: true,
  options: [] as OptionForm[],
})

const form = reactive(defaultForm())

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    optionsError.value = null
    if (props.group) {
      form.name = props.group.name
      form.active = props.group.active
      form.options = props.group.options.map((o) => ({ id: o.id, name: o.name, active: o.active }))
    } else {
      Object.assign(form, defaultForm())
    }
  },
)

const addOption = () => {
  form.options.push({ name: '', active: true })
}

const removeOption = (i: number) => {
  form.options.splice(i, 1)
}

const onConfirm = async () => {
  optionsError.value = null

  if (!formRef.value?.validate()) return false

  if (form.options.length === 0) {
    optionsError.value = 'Добавьте хотя бы одну опцию'

    return false
  }

  const validOptions = form.options.filter((o) => o.name.trim())

  if (validOptions.length === 0) {
    optionsError.value = 'Заполните названия опций'

    return false
  }

  saving.value = true
  try {
    emit('save', {
      name: form.name,
      active: form.active,
      options: validOptions,
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  @include section-title;
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-row {
  align-self: flex-start;
}

.drag-handle {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  cursor: grab;
}
</style>
