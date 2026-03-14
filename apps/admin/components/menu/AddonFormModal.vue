<template>
  <UiModal
    :model-value="modelValue"
    :title="addon ? 'Изменить добавку' : 'Новая добавка'"
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
        placeholder="Халапеньо"
        :rules="[{ required: true, message: 'Введите название' }]"
      />

      <div class="row">
        <UiInputNumber
          v-model="form.price"
          label="Цена, ₽"
          :min="0"
          :precision="0"
          placeholder="50"
          :status="priceError ? 'error' : undefined"
          :feedback="priceError"
        />
        <UiInputNumber
          v-model="form.weight"
          label="Вес, г"
          :min="0"
          :precision="0"
          placeholder="30"
        />
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiInputNumber } from '@fastio/ui'
import type { Addon } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  addon: Addon | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()

const formRef = ref()
const saving = ref(false)
const priceError = ref('')

const form = ref({
  name: '',
  price: null as number | null,
  weight: null as number | null,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = props.addon
        ? { name: props.addon.name, price: props.addon.price, weight: props.addon.weight }
        : { name: '', price: null, weight: null }
      priceError.value = ''
    }
  },
)

const actions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const handleSave = async () => {
  form.value.name = form.value.name.trim()
  priceError.value = form.value.price === null ? 'Укажите цену' : ''
  if (!formRef.value?.validate() || priceError.value) return false

  saving.value = true
  try {
    const data = {
      name: form.value.name,
      price: form.value.price ?? 0,
      weight: form.value.weight,
    }

    if (props.addon) {
      await api.addons.update(props.addon.id, data)
    } else {
      await api.addons.add(props.tenantId, data)
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
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
