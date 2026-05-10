import type { TourStep } from '~/composables/useTour'
import { useTerms } from '~/composables/useTerms'
import { useTenantStore } from '~/stores/tenant'

type NavStep = {
  selector: string
  title: string
  description: string
}

const buildNavSteps = (): NavStep[] => {
  const { item, menu, reservationsLabel } = useTerms()
  const isServices = useTenantStore().isServices

  return [
    {
      selector: 'a[href="/menu"]',
      title: menu.label,
      description: `Управляйте ${item.plural.ins}, категориями, модификаторами и добавками.`,
    },
    {
      selector: 'a[href="/orders"]',
      title: 'Заказы',
      description: isServices
        ? 'Входящие заявки в реальном времени.'
        : 'Входящие заказы в реальном времени — доставка, самовывоз, в зале.',
    },
    {
      selector: 'a[href="/kitchen"]',
      title: 'Кухня',
      description: `Экран для исполнителей: очередь ${item.plural.gen} и статусы готовности.`,
    },
    {
      selector: 'a[href="/tables"]',
      title: 'Столы',
      description: 'Схема зала, статусы столов и вызовы официанта.',
    },
    {
      selector: 'a[href="/reservations"]',
      title: reservationsLabel,
      description: isServices
        ? 'Список записей, подтверждение и управление временными слотами.'
        : 'Список броней, подтверждение и управление временными слотами.',
    },
    {
      selector: 'a[href="/promotions"]',
      title: 'Акции',
      description: 'Скидки, промокоды и специальные предложения для гостей.',
    },
    {
      selector: 'a[href="/team/members"]',
      title: 'Команда',
      description: 'Сотрудники и их роли. Доступы к разделам настраиваются здесь.',
    },
    {
      selector: 'a[href="/content"]',
      title: 'Контент сайта',
      description: 'Баннеры, галерея, отзывы и вакансии для витрины.',
    },
    {
      selector: 'a[href="/appearance"]',
      title: 'Сайт',
      description: 'Оформление: секции главной, страницы, тема и SEO.',
    },
    {
      selector: 'a[href="/settings"]',
      title: 'Настройки',
      description: `Соцсети, часовой пояс, модули, уведомления и юр. данные.`,
    },
  ]
}

export const getOnboardingSteps = (): TourStep[] => {
  const steps: TourStep[] = [
    {
      popover: {
        title: '👋 Добро пожаловать в Fastio!',
        description: 'Здесь, на странице «Помощь», собраны обучающие туры по всем разделам. Сейчас быстро покажем что где находится — нажимайте «Далее».',
      },
    },
  ]

  const navSteps = buildNavSteps()
  const firstVisible = navSteps.find((s) => document.querySelector(s.selector))

  for (const step of navSteps) {
    if (!document.querySelector(step.selector)) continue

    steps.push({
      element: step.selector,
      popover: {
        title: step === firstVisible ? `Начнём с раздела «${step.title}»` : step.title,
        description: step.description,
        side: 'right',
        align: 'center',
      },
    })
  }

  return steps
}
