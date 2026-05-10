import { useRouter, useRuntimeConfig } from '#imports'
import { useOnboarding, type OnboardingStepView } from '~/composables/useOnboarding'
import { useStorefrontUrl } from '~/composables/useStorefrontUrl'
import useTour from '~/composables/useTour'
import { TOURS } from '~/tours'

/**
 * Интенты пользователя в онбординге.
 * Компоненты эмитят семантику («перейти», «дальше», «открыть тур»), хук
 * решает, что с этим делать — роутинг, внешние окна, state-мутации.
 */
export const useOnboardingActions = () => {
  const router = useRouter()
  const helpUrl = (useRuntimeConfig().public.helpUrl as string | undefined) ?? ''
  const onboarding = useOnboarding()
  const { baseUrl: storefrontBaseUrl } = useStorefrontUrl()
  const tour = useTour()

  const openKb = (kbRoute: string | undefined) => {
    if (!kbRoute || !helpUrl) return
    window.open(`${helpUrl}${kbRoute}`, '_blank', 'noopener,noreferrer')
  }

  const goToStep = async (step: OnboardingStepView) => {
    if (step.externalTarget === 'storefront') {
      window.open(storefrontBaseUrl.value, '_blank', 'noopener,noreferrer')

      return
    }
    if (!step.route) return
    await router.push(step.route)
  }

  /** Запускает driver.js-тур по id. Если тура нет — падаем в KB. */
  const startStepTour = async (step: OnboardingStepView) => {
    const t = step.tourId ? TOURS.find((x) => x.id === step.tourId) : undefined

    if (!t) {
      openKb(step.kbRoute)

      return
    }
    await tour.start(t.getSteps())
  }

  /** «Дальше» — просто помечаем шаг пройденным и двигаемся к следующему. */
  const nextStep = (step: OnboardingStepView) => onboarding.completeStep(step.id)

  return {
    goToStep,
    startStepTour,
    openKb,
    nextStep,
  }
}
