<template>
  <UiModal
    :model-value="modelValue"
    :title="status ? 'Изменить статус' : 'Новый статус'"
    :width="560"
    :actions="actions"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <div data-tour="status-form-name">
        <UiInput
          v-model="form.name"
          name="name"
          label="Название"
          placeholder="В работе"
          :rules="[{ required: true, message: 'Введите название' }]"
        />
      </div>

      <div data-tour="status-form-group">
        <UiSelect
          :value="form.groupType"
          :options="groupOptions"
          label="Группа"
          message="Группа определяет поведение заказа в этом статусе"
          size="small"
          @update:value="form.groupType = $event as OrderStatusGroup"
        />
      </div>

      <div v-if="allowedTargets.length" data-tour="status-form-actions" class="actions-group">
        <UiSelect
          :value="form.quickAction1"
          :options="quickActionOptions1"
          label="Быстрое действие 1"
          size="small"
          clearable
          placeholder="Не задано"
          @update:value="form.quickAction1 = ($event as string) ?? null"
        />

        <UiSelect
          :value="form.quickAction2"
          :options="quickActionOptions2"
          label="Быстрое действие 2"
          message="Кнопки перехода в другой статус на карточке заказа (макс. 2)"
          size="small"
          clearable
          :disabled="!form.quickAction1"
          placeholder="Не задано"
          @update:value="form.quickAction2 = ($event as string) ?? null"
        />
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiSelect } from '@fastio/ui'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { getAllowedStatuses } from '@fastio/shared'
import { STATUS_GROUP_LABELS } from '~/config/retail/order-status-groups'

const props = defineProps<{
  modelValue: boolean
  status: OrderStatus | null
  allStatuses: OrderStatus[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: { name: string; groupType: OrderStatusGroup; quickActions: string[] }]
}>()

const formRef = ref()

const form = ref({
  name: '',
  groupType: 'new' as OrderStatusGroup,
  quickAction1: null as string | null,
  quickAction2: null as string | null,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.status) {
        form.value = {
          name: props.status.name,
          groupType: props.status.groupType,
          quickAction1: props.status.quickActions[0] ?? null,
          quickAction2: props.status.quickActions[1] ?? null,
        }
      } else {
        form.value = { name: '', groupType: 'new', quickAction1: null, quickAction2: null }
      }
    }
  },
)

const groupOptions = (Object.keys(STATUS_GROUP_LABELS) as OrderStatusGroup[]).map((key) => ({
  label: STATUS_GROUP_LABELS[key],
  value: key,
}))

watch(() => form.value.groupType, () => {
  form.value.quickAction1 = null
  form.value.quickAction2 = null
})

const allowedTargets = computed(() => {
  const currentId = props.status?.id

  return getAllowedStatuses(form.value.groupType, props.allStatuses)
    .filter((s) => s.id !== currentId)
})

const quickActionOptions1 = computed(() => allowedTargets.value.map((s) => ({ label: s.name, value: s.id })))

const quickActionOptions2 = computed(() => allowedTargets.value
  .filter((s) => s.id !== form.value.quickAction1)
  .map((s) => ({ label: s.name, value: s.id })))

const actions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const },
])

const handleSave = async () => {
  form.value.name = form.value.name.trim()
  if (!formRef.value?.validate()) return false

  const quickActions = [form.value.quickAction1, form.value.quickAction2].filter(Boolean) as string[]

  emit('save', {
    name: form.value.name,
    groupType: form.value.groupType,
    quickActions,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  @include modal-form;
}

.actions-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}
</style>
