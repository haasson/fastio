<template>
  <div v-if="isVisible" class="onboarding-root">
    <Teleport defer to="#onboarding-sidebar-slot">
      <OnboardingSidebarEntry
        :active="open"
        :done="allCompleted"
        :completed="progress.completed"
        :total="progress.total"
        @click="togglePanel"
      />
    </Teleport>

    <OnboardingPanel
      :show="open"
      :steps="steps"
      :completed="progress.completed"
      :total="progress.total"
      :subtitle="subtitle"
      :all-completed="allCompleted"
      @update:show="(v: boolean) => (open = v)"
      @dismiss="dismissModal = true"
      @reset="resetModal = true"
      @finish="handleFinish"
      @step-go="handleStepGo"
      @step-next="actions.nextStep"
      @step-tour="handleStepTour"
      @step-kb="(s) => actions.openKb(s.kbRoute)"
    />

    <OnboardingDismissModal
      :show="dismissModal"
      @update:show="(v: boolean) => (dismissModal = v)"
      @confirm="handleDismiss"
    />

    <OnboardingResetModal
      :show="resetModal"
      @update:show="(v: boolean) => (resetModal = v)"
      @confirm="handleReset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import OnboardingSidebarEntry from './OnboardingSidebarEntry.vue'
import OnboardingPanel from './OnboardingPanel.vue'
import OnboardingDismissModal from './OnboardingDismissModal.vue'
import OnboardingResetModal from './OnboardingResetModal.vue'
import { useOnboarding, type OnboardingStepView } from '~/composables/useOnboarding'
import { useOnboardingActions } from '~/composables/useOnboardingActions'

const {
  isVisible,
  steps,
  progress,
  allCompleted,
  dismiss,
  finish,
  reset,
} = useOnboarding()
const actions = useOnboardingActions()

const open = ref(false)
const dismissModal = ref(false)
const resetModal = ref(false)

const subtitle = computed(() => {
  if (allCompleted.value) return 'Все шаги пройдены — витрина готова.'

  return `Пройдено ${progress.value.completed} из ${progress.value.total} шагов до запуска`
})

const togglePanel = () => {
  open.value = !open.value
}

const handleStepGo = async (step: OnboardingStepView) => {
  // Внешние ссылки (витрина) открываются в новой вкладке — дровер оставляем открытым,
  // чтобы после проверки было удобно нажать «Дальше».
  if (!step.externalTarget) open.value = false
  await actions.goToStep(step)
}

const handleStepTour = async (step: OnboardingStepView) => {
  open.value = false
  await actions.startStepTour(step)
}

const handleDismiss = async () => {
  dismissModal.value = false
  open.value = false
  await nextTick()
  await dismiss()
}

const handleReset = async () => {
  resetModal.value = false
  await reset()
}

const handleFinish = async () => {
  open.value = false
  await nextTick()
  await finish()
}
</script>
