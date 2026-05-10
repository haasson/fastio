<template>
  <UiDrawer
    :model-value="show"
    placement="left"
    :width="520"
    to=".main"
    :show-mask="false"
    :mask-closable="false"
    :z-index="50"
    header-align="start"
    @update:model-value="(v: boolean) => emit('update:show', v)"
  >
    <template #title>
      <div class="title-block">
        <UiTitle size="h5">Чек-лист запуска</UiTitle>
        <UiText size="tiny" class="subtitle">{{ subtitle }}</UiText>
        <template v-if="!allCompleted">
          <OnboardingProgressBar :total="total" :completed="completed" />
          <UiText size="tiny" class="legend">
            Кнопка <strong>«Дальше»</strong> просто двигает вас по шагам — неважно, сделали
            вы что-то или уже умеете. Клик по
            <span class="legend-icon"><UiIcon name="graduationCap" :size="12" /></span>
            откроет статью в базе знаний, а
            <span class="legend-icon"><UiIcon name="sparkles" :size="12" /></span>
            запустит короткий тур.
          </UiText>
        </template>
      </div>
    </template>

    <div v-if="allCompleted" class="completed-body">
      <div class="completed-icon">
        <UiIcon name="check" :size="32" />
      </div>
      <UiTitle size="h4">Чек-лист пройден</UiTitle>
      <UiText>
        Все шаги отмечены — витрина готова к запуску. Можно закрыть чек-лист навсегда
        или пройти заново, если хочется перепроверить.
      </UiText>
      <div class="completed-actions">
        <UiButton type="primary" @click="emit('finish')">
          Закрыть навсегда
        </UiButton>
        <UiButton type="default" @click="emit('reset')">
          Пройти заново
        </UiButton>
      </div>
    </div>

    <div v-else class="body">
      <div class="steps">
        <OnboardingStepItem
          v-for="step in steps"
          :key="step.id"
          :step="step"
          @go="emit('step-go', $event)"
          @next="emit('step-next', $event)"
          @tour="emit('step-tour', $event)"
          @kb="emit('step-kb', $event)"
        />
      </div>
    </div>

    <template v-if="!allCompleted" #footer>
      <div class="panel-footer">
        <UiButton type="text" size="small" @click="emit('reset')">
          Начать заново
        </UiButton>
        <UiButton type="text" size="small" @click="emit('dismiss')">
          Скрыть чек-лист
        </UiButton>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { UiButton, UiDrawer, UiIcon, UiText, UiTitle } from '@fastio/ui'
import OnboardingStepItem from './OnboardingStepItem.vue'
import OnboardingProgressBar from './OnboardingProgressBar.vue'
import type { OnboardingStepView } from '../composables/useOnboarding'

defineProps<{
  show: boolean
  steps: OnboardingStepView[]
  completed: number
  total: number
  subtitle: string
  allCompleted: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'dismiss'): void
  (e: 'reset'): void
  (e: 'finish'): void
  (e: 'step-go', step: OnboardingStepView): void
  (e: 'step-next', step: OnboardingStepView): void
  (e: 'step-tour', step: OnboardingStepView): void
  (e: 'step-kb', step: OnboardingStepView): void
}>()
</script>

<style scoped lang="scss">
.title-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  flex: 1;
  min-width: 0;
  padding: var(--space-4) 0;
}

.subtitle {
  font-weight: var(--font-weight-regular);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.legend {
  font-size: var(--font-size-xs);
  line-height: 1.4;

  strong {
    font-weight: var(--font-weight-semibold);
  }
}

.legend-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  padding: 0 2px;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-footer {
  display: flex;
  justify-content: center;
  gap: var(--space-16);
  width: 100%;
}

.completed-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-16);
  padding: var(--space-32) var(--space-16);
}

.completed-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: var(--color-white);
}

.completed-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  justify-content: center;
  margin-top: var(--space-8);
}
</style>
