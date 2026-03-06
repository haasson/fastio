<template>
  <UiModal
    :model-value="modelValue"
    :title="status ? 'Редактировать статус' : 'Новый статус'"
    :width="400"
    :actions="modalActions"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название *"
        placeholder="Упаковывается"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />
      <UiRadioGroup
        v-model="form.groupType"
        label="Группа *"
        :options="groupOptions"
        :vertical="true"
      />
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiRadioGroup } from '@fastio/ui'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { STATUS_GROUP_LABELS } from '~/config/order-status-groups'

const props = defineProps<{
  modelValue: boolean
  status?: OrderStatus | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: { name: string; groupType: OrderStatusGroup }]
}>()

const formRef = ref()
const saving = ref(false)

const groupOptions = (Object.keys(STATUS_GROUP_LABELS) as OrderStatusGroup[]).map((key) => ({
  label: STATUS_GROUP_LABELS[key],
  value: key,
}))

const defaultForm = () => ({
  name: props.status?.name ?? '',
  groupType: (props.status?.groupType ?? 'new') as OrderStatusGroup,
})
const form = reactive(defaultForm())

watch(
  () => props.modelValue,
  (val) => { if (val) Object.assign(form, defaultForm()) },
)

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: props.status ? 'Сохранить' : 'Создать', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const onConfirm = async () => {
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    emit('save', { name: form.name, groupType: form.groupType })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
