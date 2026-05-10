<template>
  <div class="step-type-root">
    <UiTitle size="h3">Добро пожаловать в Fastio!</UiTitle>
    <UiText size="small" class="hint">
      Давайте настроим ваш аккаунт за пару минут. Для начала выберите тип бизнеса —
      это поможет нам подготовить интерфейс, подходящий именно вам.
    </UiText>

    <UiText v-if="showError" size="small" class="error">Выберите тип бизнеса</UiText>

    <div class="options">
      <OnboardingOption
        v-for="option in options"
        :key="option.type"
        :icon="option.icon"
        :title="option.title"
        :desc="option.desc"
        :selected="modelValue === option.type"
        @select="$emit('update:modelValue', option.type)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiTitle, UiText } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import type { BusinessType } from '@fastio/shared'
import OnboardingOption from './OnboardingOption.vue'

const props = defineProps<{ modelValue: BusinessType | null }>()

defineEmits<{ 'update:modelValue': [value: BusinessType] }>()

const showError = ref(false)

watch(() => props.modelValue, (v) => {
  if (v) showError.value = false
})

defineExpose({
  validate: () => {
    if (!props.modelValue) {
      showError.value = true

      return false
    }

    return true
  },
})

const options: { type: BusinessType; icon: IconName; title: string; desc: string }[] = [
  {
    type: 'retail',
    icon: 'dishes',
    title: 'Продаю товары / еду',
    desc: 'Ресторан, кафе, магазин, пекарня, доставка',
  },
  {
    type: 'services',
    icon: 'users',
    title: 'Оказываю услуги / принимаю запись',
    desc: 'Красота, образование, ремонт, клиника, любые сервисы',
  },
]
</script>

<style scoped lang="scss">
.step-type-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.hint {
  color: var(--color-text-secondary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.error {
  color: var(--color-error);
}
</style>
