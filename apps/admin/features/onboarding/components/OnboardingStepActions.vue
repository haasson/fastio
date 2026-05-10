<template>
  <div class="actions-root">
    <UiButton
      v-if="step.ctaLabel && (step.route || step.externalTarget)"
      type="primary"
      size="small"
      @click="emit('go', step)"
    >
      {{ step.ctaLabel }}
    </UiButton>
    <UiButton
      type="default"
      size="small"
      @click="emit('next', step)"
    >
      Дальше
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'
import type { OnboardingStepView } from '~/composables/useOnboarding'

defineProps<{ step: OnboardingStepView }>()
const emit = defineEmits<{
  (e: 'go', step: OnboardingStepView): void
  (e: 'next', step: OnboardingStepView): void
}>()
</script>

<style scoped lang="scss">
.actions-root {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
</style>
