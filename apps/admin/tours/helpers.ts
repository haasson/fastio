import type { Side, Alignment } from 'driver.js'
import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'

// Принимает либо голое имя (`kitchen-tab-queue`) — превращает в `[data-tour="..."]`,
// либо готовый CSS-селектор (`.queue-panel`) — возвращает как есть
const toSelector = (s: string) => /^[\w-]+$/.test(s) ? `[data-tour="${s}"]` : s

export const intro = (opts: {
  title: string
  description: string
}): TourStep => ({
  popover: { title: opts.title, description: opts.description },
})

export const highlight = (opts: {
  target: string
  title: string
  description: string
  side?: Side
  align?: Alignment
}): TourStep => ({
  element: toSelector(opts.target),
  popover: {
    title: opts.title,
    description: opts.description,
    side: opts.side ?? 'right',
    align: opts.align ?? 'start',
  },
})

export const formField = (opts: {
  target: string
  title: string
  description: string
}): TourStep => highlight(opts)

export const saveButton = (opts: {
  target: string
  title: string
  description: string
}): TourStep => highlight({ ...opts, side: 'top', align: 'end' })

export const clickAndWait = (opts: {
  target: string
  title: string
  description: string
  waitTarget: string
  side?: Side
  align?: Alignment
  beforeWait?: () => void
}): TourStep => {
  const sel = toSelector(opts.target)
  const waitSel = toSelector(opts.waitTarget)

  return {
    element: sel,
    popover: {
      title: opts.title,
      description: opts.description,
      side: opts.side ?? 'bottom',
      align: opts.align ?? 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>(sel)?.click()
      opts.beforeWait?.()
      await waitForElement(waitSel)
    },
  }
}

export const navigateToMenuStep = (waitTarget: string): TourStep => {
  const waitSel = toSelector(waitTarget)

  return {
    element: 'a[href="/menu"]',
    popover: {
      title: 'Раздел «Меню»',
      description: 'Здесь находится всё управление меню — блюда, категории, модификаторы. Нажмите «Далее» чтобы перейти.',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/menu"]')?.click()
      await waitForElement(waitSel)
    },
  }
}

export const clickMenuTabStep = (opts: {
  target: string
  title: string
  description: string
  waitTarget: string
  afterClick?: () => void
}): TourStep => {
  const sel = toSelector(opts.target)
  const waitSel = toSelector(opts.waitTarget)

  return {
    element: sel,
    popover: {
      title: opts.title,
      description: opts.description,
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>(sel)?.click()
      opts.afterClick?.()
      await waitForElement(waitSel)
    },
  }
}

export const navigateToOrdersStep = (waitTarget: string): TourStep => {
  const waitSel = toSelector(waitTarget)

  return {
    element: 'a[href="/orders"]',
    popover: {
      title: 'Раздел «Заказы»',
      description: 'Переходим в раздел Заказы. Нажмите «Далее».',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/orders"]')?.click()
      await waitForElement(waitSel)
    },
  }
}

export const clickOrdersTabStep = (opts: {
  target: string
  title: string
  description: string
  waitTarget: string
}): TourStep => {
  const sel = toSelector(opts.target)
  const waitSel = toSelector(opts.waitTarget)

  return {
    element: sel,
    popover: {
      title: opts.title,
      description: opts.description,
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>(sel)?.click()
      await waitForElement(waitSel)
    },
  }
}

export const withEmptyHint = (step: TourStep, opts: {
  checkSelector: string
  hint: string
}): TourStep => {
  const baseDescription = step.popover?.description ?? ''

  return {
    ...step,
    onHighlightStarted: (_el, s) => {
      if (!s.popover) return
      const isEmpty = !document.querySelector(opts.checkSelector)

      s.popover.description = isEmpty
        ? `${baseDescription}<br><br><i style="color:var(--color-text-hint)">${opts.hint}</i>`
        : baseDescription
    },
  }
}

export const navigateToKitchenStep = (waitTarget: string): TourStep => {
  const waitSel = toSelector(waitTarget)

  return {
    element: 'a[href="/kitchen"]',
    popover: {
      title: 'Раздел «Кухня»',
      description: 'Переходим в раздел Кухня. Нажмите «Далее».',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/kitchen"]')?.click()
      await waitForElement(waitSel)
    },
  }
}

export const clickKitchenTabStep = (opts: {
  target: string
  title: string
  description: string
  waitTarget: string
}): TourStep => {
  const sel = toSelector(opts.target)
  const waitSel = toSelector(opts.waitTarget)

  return {
    element: sel,
    popover: {
      title: opts.title,
      description: opts.description,
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>(sel)?.click()
      await waitForElement(waitSel)
    },
  }
}

