<template>
  <component
    :is="isOpen ? UiCard : 'div'"
    :size="isOpen ? 'small' : undefined"
    class="step-item-root"
    :class="`status-${step.status}`"
  >
    <div class="head">
      <OnboardingStepStatusIcon
        :status="step.status"
        :label="isOpen ? undefined : step.index + 1"
      />
      <UiText size="tiny" class="title">{{ step.title }}</UiText>
      <button
        v-if="step.tourId"
        type="button"
        class="head-hint"
        title="Пройти тур"
        @click="emit('tour', step)"
      >
        <UiIcon name="sparkles" :size="14" />
      </button>
      <button
        v-if="step.kbRoute"
        type="button"
        class="head-hint"
        title="Открыть в базе знаний"
        @click="emit('kb', step)"
      >
        <UiIcon name="graduationCap" :size="14" />
      </button>
    </div>

    <div v-if="isOpen" class="body">
      <UiText size="tiny" class="description">{{ step.description }}</UiText>

      <ul v-if="step.details?.length" class="details">
        <li v-for="(detail, idx) in step.details" :key="idx">
          <UiText size="tiny">{{ detail }}</UiText>
        </li>
      </ul>

      <OnboardingStepActions
        :step="step"
        @go="emit('go', $event)"
        @next="emit('next', $event)"
      />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiIcon, UiText } from '@fastio/ui'
import OnboardingStepStatusIcon from './OnboardingStepStatusIcon.vue'
import OnboardingStepActions from './OnboardingStepActions.vue'
import type { OnboardingStepView } from '~/composables/useOnboarding'

const props = defineProps<{ step: OnboardingStepView }>()
const emit = defineEmits<{
  (e: 'go', step: OnboardingStepView): void
  (e: 'next', step: OnboardingStepView): void
  (e: 'tour', step: OnboardingStepView): void
  (e: 'kb', step: OnboardingStepView): void
}>()

const isOpen = computed(() => props.step.status === 'active')
</script>

<style scoped lang="scss">
.step-item-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);

  // Свёрнутые шаги — обычный ряд в панели, не карточка.
  &:where(:not(.status-active)) {
    padding: var(--space-8) var(--space-12);
  }

  &.status-done {
    opacity: 0.5;

    .title {
      text-decoration: line-through;
    }
  }

  &.status-locked {
    opacity: 0.35;
  }

  // Активный шаг — UiCard сам рулит padding/radius; нам нужен только dashed-штрих + лёгкий серый фон.
  &.status-active {
    border: 1px dashed var(--color-border);
    background: var(--color-bg-subtle);
  }
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.title {
  font-weight: var(--font-weight-semibold);
  flex: 1;
  min-width: 0;
}

.head-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-8);
  border: none;
  padding: 0;
  background: transparent;
  color: var(--color-text-hint);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);

  &:hover {
    opacity: 1;
    background: var(--color-bg-hover);
    color: var(--color-text);
  }
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-left: 24px;
}

.details {
  margin: 0;
  padding-left: var(--space-20);
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: disc outside;

  li {
    line-height: 1.35;
    display: list-item;
  }
}

</style>
