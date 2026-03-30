import type { TourStep } from '~/composables/useTour'

type NavStep = {
  selector: string
  title: string
  description: string
}

const navSteps: NavStep[] = [
  {
    selector: 'a[href="/menu"]',
    title: 'Меню',
    description: 'Управляйте блюдами, категориями, модификаторами и добавками.',
  },
  {
    selector: 'a[href="/orders"]',
    title: 'Заказы',
    description: 'Входящие заказы в реальном времени — доставка, самовывоз, в зале.',
  },
  {
    selector: 'a[href="/kitchen"]',
    title: 'Кухня',
    description: 'Экран для поваров: очередь блюд и статусы готовности.',
  },
  {
    selector: 'a[href="/tables"]',
    title: 'Столы',
    description: 'Схема зала, статусы столов и вызовы официанта.',
  },
  {
    selector: 'a[href="/reservations"]',
    title: 'Бронирования',
    description: 'Список броней, подтверждение и управление временными слотами.',
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
    description: 'Баннеры, галерея, отзывы и вакансии для storefront.',
  },
  {
    selector: 'a[href="/appearance"]',
    title: 'Сайт',
    description: 'Оформление: секции главной, страницы, тема и SEO.',
  },
  {
    selector: 'a[href="/settings"]',
    title: 'Настройки',
    description: 'Контакты, часы работы, зоны доставки, модули и интеграции.',
  },
]

export const getOnboardingSteps = (): TourStep[] => {
  const steps: TourStep[] = [
    {
      popover: {
        title: '👋 Добро пожаловать в Fastio!',
        description: 'Здесь, на странице «Помощь», собраны обучающие туры по всем разделам. Сейчас быстро покажем что где находится — нажимайте «Далее».',
      },
    },
  ]

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
