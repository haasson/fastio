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
      <div data-tour="modifier-name">
        <UiInput
          v-model="form.name"
          name="name"
          label="Название группы *"
          placeholder="Размер, Диаметр, Бортик..."
          :rules="[{ type: 'required', message: 'Введите название' }]"
        />
      </div>

      <div class="switch-row" data-tour="modifier-switches">
        <UiSwitch v-model="form.active" label="Активна" data-tour="modifier-active" />
        <UiSwitch v-model="form.affectsWeight" label="Влияет на вес" data-tour="modifier-affects-weight" />
      </div>

      <div v-if="form.affectsWeight" class="weight-mode-block" data-tour="modifier-weight-mode">
        <div class="weight-mode-label">
          <UiText size="tiny" color="secondary">Вес задаётся</UiText>
          <UiInfoTip>
            <UiText size="tiny">
              <b>На уровне модификатора</b> — вес одинаковый для всех блюд, которые используют эту группу. Укажи его прямо здесь, рядом с каждой опцией.<br/><br/>
              <b>Каждое блюдо своё</b> — вес задаётся отдельно для каждого блюда в форме редактирования блюда.
            </UiText>
          </UiInfoTip>
        </div>
        <UiSegmentedControl
          v-model:model-value="form.weightMode"
          size="small"
          :items="weightModeItems"
        />
      </div>

      <div class="options-section" data-tour="modifier-options">
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
            <UiInputNumber
              v-if="form.affectsWeight && form.weightMode === 'global'"
              v-model:model-value="opt.weight"
              :show-button="true"
              placeholder="—"
              class="weight-input"
            >
              <template #suffix>г / мл</template>
            </UiInputNumber>
            <UiButton size="tiny" type="text" @click="removeOption(i)">
              ✕
            </UiButton>
          </div>
        </VueDraggable>

        <UiAlert v-if="optionsError" type="error" size="small">
          {{ optionsError }}
        </UiAlert>

        <UiButton
          type="default"
          icon="plus"
          data-tour="modifier-add-option"
          @click="addOption"
        >
          Добавить опцию
        </UiButton>
      </div>

      <UiCollapse v-if="group?.id" :expanded-names="[]">
        <UiCollapseItem name="audit" title="История изменений">
          <AuditTrail
            entity-type="modifier_group"
            :entity-id="group.id"
            :refresh-key="refreshKey"
            include-children
            show-entity
          />
        </UiCollapseItem>
      </UiCollapse>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiModal, UiForm, UiInput, UiInputNumber, UiButton, UiSwitch, UiText, UiIcon, UiAlert, UiSegmentedControl, UiInfoTip, UiCollapse, UiCollapseItem } from '@fastio/ui'
import type { ModifierGroup, ModifierGroupFormData } from '@fastio/shared'
import AuditTrail from '~/features/audit-log/components/AuditTrail.vue'

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
// Модалка закрывается на сохранении, поэтому ленту истории обновляем при каждом
// открытии (не на save — триггер пишет уже после закрытия).
const refreshKey = ref(0)

const weightModeItems = [
  { label: 'На уровне модификатора', value: 'global' },
  { label: 'Каждое блюдо своё', value: 'per_dish' },
]

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value, buttonProps: { 'data-tour': 'modifier-save' } },
])

type OptionForm = { id?: string; name: string; active: boolean; weight: number | null }

const defaultForm = () => ({
  name: '',
  active: true,
  affectsWeight: false,
  weightMode: 'global' as 'global' | 'per_dish',
  options: [] as OptionForm[],
})

const form = reactive(defaultForm())

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    optionsError.value = null
    refreshKey.value++
    if (props.group) {
      form.name = props.group.name
      form.active = props.group.active
      form.affectsWeight = props.group.affectsWeight
      form.weightMode = props.group.weightMode
      form.options = props.group.options.map((o) => ({ id: o.id, name: o.name, active: o.active, weight: o.weight }))
    } else {
      Object.assign(form, defaultForm())
    }
  },
)

const addOption = () => {
  form.options.push({ name: '', active: true, weight: null })
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
      affectsWeight: form.affectsWeight,
      weightMode: form.weightMode,
      options: validOptions,
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.section-title {
  @include section-title;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-20);
}

.weight-mode-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.weight-mode-label {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.option-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.weight-input {
  width: 100px;
  flex-shrink: 0;
}

.drag-handle {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  cursor: grab;
}
</style>
