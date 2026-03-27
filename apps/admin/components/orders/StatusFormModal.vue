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
      <UiInput
        v-model="form.name"
        name="name"
        label="Название"
        placeholder="В работе"
        :rules="[{ required: true, message: 'Введите название' }]"
      />

      <div class="field">
        <UiText size="small" weight="medium" class="label">Группа</UiText>
        <UiSelect
          :value="form.groupType"
          :options="groupOptions"
          size="small"
          @update:value="form.groupType = $event as OrderStatusGroup"
        />
        <UiText size="tiny" color="tertiary">
          Группа определяет поведение заказа в этом статусе
        </UiText>
      </div>

      <div class="field">
        <UiText size="small" weight="medium" class="label">Быстрое действие 1</UiText>
        <UiSelect
          :value="form.quickAction1"
          :options="quickActionOptions1"
          size="small"
          clearable
          placeholder="Не задано"
          @update:value="form.quickAction1 = ($event as string) ?? null"
        />
      </div>

      <div class="field">
        <UiText size="small" weight="medium" class="label">Быстрое действие 2</UiText>
        <UiSelect
          :value="form.quickAction2"
          :options="quickActionOptions2"
          size="small"
          clearable
          :disabled="!form.quickAction1"
          placeholder="Не задано"
          @update:value="form.quickAction2 = ($event as string) ?? null"
        />
        <UiText size="tiny" color="tertiary">
          Кнопки перехода в другой статус на карточке заказа (макс. 2)
        </UiText>
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiText, UiSelect } from '@fastio/ui'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { STATUS_GROUP_LABELS } from '~/config/order-status-groups'

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

const quickActionOptions1 = computed(() => {
  const currentId = props.status?.id

  return props.allStatuses
    .filter((s) => s.id !== currentId)
    .map((s) => ({ label: s.name, value: s.id }))
})

const quickActionOptions2 = computed(() => {
  const currentId = props.status?.id

  return props.allStatuses
    .filter((s) => s.id !== currentId && s.id !== form.value.quickAction1)
    .map((s) => ({ label: s.name, value: s.id }))
})

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
</style>
