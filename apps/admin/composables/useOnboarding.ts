import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { emptyOnboardingState, type OnboardingState } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useTerms } from '~/composables/useTerms'
import { reportError } from '~/utils/reportError'
import {
  buildOnboardingFlow,
  type OnboardingStep,
  type OnboardingLabels,
} from '~/config/onboarding'

export type StepStatus = 'done' | 'active' | 'locked'

export type OnboardingStepView = OnboardingStep & {
  index: number
  status: StepStatus
}

export const useOnboarding = () => {
  const tenantStore = useTenantStore()
  const { tenant, isOwner } = storeToRefs(tenantStore)
  const terms = useTerms()
  const { item, menu } = terms

  const onboardingLabels = computed<OnboardingLabels>(() => ({
    menu: menu.label,
    menuPurpose: menu.nom,
    item: item.nom,
    itemAcc: item.acc,
    firstItemAcc: terms.firstItemAcc,
    categoryExamples: terms.categoryExamples,
  }))

  const flow = computed(() => buildOnboardingFlow(onboardingLabels.value, {
    isServices: terms.isServices,
    modules: tenant.value?.modules ?? null,
  }))

  const state = computed<OnboardingState>(() => tenant.value?.onboardingState ?? emptyOnboardingState())

  const allCompleted = computed(() => state.value.completedAt !== null)

  /**
   * Индекс активного шага во флоу. Всё до него — done, после — locked.
   * Если completedAt выставлен — юзер за финалом (index = flow.length).
   * Если currentStepId не найден во флоу (флоу изменился) — начинаем с нуля.
   */
  const currentIndex = computed(() => {
    if (allCompleted.value) return flow.value.length
    if (!state.value.currentStepId) return 0
    const idx = flow.value.findIndex((s) => s.id === state.value.currentStepId)

    return idx === -1 ? 0 : idx
  })

  const steps = computed<OnboardingStepView[]>(() => flow.value.map((step, i) => {
    let status: StepStatus

    if (i < currentIndex.value) status = 'done'
    else if (i === currentIndex.value) status = 'active'
    else status = 'locked'

    return { ...step, index: i, status }
  }))

  const activeStepId = computed<string | null>(() => steps.value.find((s) => s.status === 'active')?.id ?? null)

  const progress = computed(() => ({
    completed: Math.min(currentIndex.value, flow.value.length),
    total: flow.value.length,
  }))

  const isVisible = computed(() => {
    if (state.value.dismissedAt) return false

    return isOwner.value && !!tenant.value
  })

  const persistState = async (next: OnboardingState) => {
    if (!tenant.value) return
    try {
      await tenantStore.update({ onboardingState: next })
    } catch (e) {
      reportError(e)
    }
  }

  /**
   * «Дальше» — двигаем указатель на следующий шаг. На последнем шаге выставляем
   * completedAt (финальный экран); dismissedAt ставит только явный «Закрыть навсегда».
   */
  const completeStep = (stepId: string) => {
    const idx = flow.value.findIndex((s) => s.id === stepId)

    if (idx === -1) return Promise.resolve()
    const isLast = idx === flow.value.length - 1

    if (isLast) {
      return persistState({ ...state.value, currentStepId: null, completedAt: new Date().toISOString() })
    }

    return persistState({ ...state.value, currentStepId: flow.value[idx + 1].id })
  }

  const dismiss = () => persistState({ ...state.value, dismissedAt: new Date().toISOString() })

  /** Явное «готово, больше не показывать». */
  const finish = () => {
    const now = new Date().toISOString()

    return persistState({ ...state.value, completedAt: state.value.completedAt ?? now, dismissedAt: now })
  }

  const reset = () => persistState(emptyOnboardingState())

  return {
    isVisible,
    steps,
    progress,
    allCompleted,
    activeStepId,
    completeStep,
    dismiss,
    finish,
    reset,
  }
}
