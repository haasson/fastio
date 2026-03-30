import { ref } from 'vue'
import type { DriveStep, Config } from 'driver.js'

export type TourStep = DriveStep & {
  onNext?: () => Promise<void>
}

export const waitForElement = (selector: string, timeout = 5000): Promise<HTMLElement> => new Promise((resolve, reject) => {
  const el = document.querySelector<HTMLElement>(selector)

  if (el) return resolve(el)

  const observer = new MutationObserver(() => {
    const found = document.querySelector<HTMLElement>(selector)

    if (found) {
      observer.disconnect()
      resolve(found)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => {
    observer.disconnect()
    reject(new Error(`Timeout waiting for ${selector}`))
  }, timeout)
})

export const clickToAdvance = (step: TourStep): TourStep => ({
  ...step,
  popover: {
    ...step.popover,
    showButtons: ['previous', 'close'],
  },
  onHighlightStarted: (el, _step, { driver }) => {
    el?.addEventListener('click', () => driver.moveNext(), { once: true })
  },
})

export const clickToAdvanceWhen = (step: TourStep, waitSelector: string): TourStep => ({
  ...step,
  popover: {
    ...step.popover,
    showButtons: ['previous', 'close'],
  },
  onHighlightStarted: (el, _step, { driver }) => {
    el?.addEventListener('click', () => {
      waitForElement(waitSelector)
        .then(() => driver.moveNext())
        .catch(() => driver.moveNext())
    }, { once: true })
  },
})

const isActive = ref(false)
let driverObj: { drive: () => void; destroy: () => void; moveNext: () => void } | null = null

const useTour = () => {
  const start = async (steps: TourStep[], config: Partial<Config> = {}) => {
    const { driver } = await import('driver.js')

    driverObj = driver({
      showProgress: true,
      nextBtnText: 'Далее →',
      prevBtnText: '← Назад',
      doneBtnText: 'Готово',
      progressText: '{{current}} / {{total}}',
      allowClose: true,
      disableActiveInteraction: true,
      onNextClick: (_el, _step, { state }) => {
        const step = state.activeIndex != null ? steps[state.activeIndex] as TourStep : undefined

        if (step?.onNext) {
          step.onNext().then(() => driverObj?.moveNext())
        } else {
          driverObj?.moveNext()
        }
      },
      onDestroyed: () => {
        isActive.value = false
      },
      ...config,
      steps,
    })

    isActive.value = true
    driverObj.drive()
  }

  const stop = () => {
    driverObj?.destroy()
    isActive.value = false
  }

  return { start, stop, isActive }
}

export default useTour
