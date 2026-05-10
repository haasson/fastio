<template>
  <div class="step-info-root">
    <UiTitle size="h3">О заведении</UiTitle>
    <UiText size="small" class="hint">
      Базовая информация для вашей витрины и клиентов.
    </UiText>

    <UiForm ref="formRef" class="fields">
      <UiInput
        v-model="nameModel"
        name="name"
        label="Название заведения"
        placeholder="Например: Кафе «Уют»"
        :rules="[validationRules.name.required]"
      />

      <UiInput
        v-model="phoneModel"
        name="phone"
        label="Телефон"
        :rules="[validationRules.phone.required, validationRules.phone.format]"
      />

      <UiSelect
        label="Часовой пояс"
        :value="timezone"
        :options="timezoneOptions"
        @update:value="$emit('update:timezone', String($event))"
      />
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiTitle, UiInput, UiText, UiSelect, UiForm } from '@fastio/ui'
import { validationRules } from '@fastio/kit'
import { TIMEZONE_OPTIONS } from '@fastio/shared'

const props = defineProps<{
  name: string
  phone: string
  timezone: string
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:phone': [value: string]
  'update:timezone': [value: string]
}>()

const formRef = ref<InstanceType<typeof UiForm> | null>(null)

const nameModel = computed({
  get: () => props.name,
  set: (v) => emit('update:name', v ?? ''),
})

const phoneModel = computed({
  get: () => props.phone,
  set: (v) => emit('update:phone', v ?? ''),
})

const timezoneOptions = TIMEZONE_OPTIONS.map((tz) => ({
  label: tz.label,
  value: tz.value,
}))

defineExpose({
  validate: () => formRef.value?.validate() ?? true,
})
</script>

<style scoped lang="scss">
.step-info-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.hint {
  color: var(--color-text-secondary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}
</style>
