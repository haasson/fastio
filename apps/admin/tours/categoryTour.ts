import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'

export const getCategoryTourSteps = (): TourStep[] => [
  {
    popover: {
      title: 'Категории меню',
      description: 'Сейчас покажем как создавать разделы меню: «Бургеры», «Напитки», «Десерты». Сначала перейдём в нужный раздел — нажмите «Далее».',
    },
  },
  {
    element: 'a[href="/menu"]',
    popover: {
      title: 'Раздел «Меню»',
      description: 'Здесь находится всё управление меню — блюда, категории, модификаторы. Нажмите «Далее» чтобы перейти.',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/menu"]')?.click()
      await waitForElement('[data-tour="menu-tab-categories"]')
    },
  },
  {
    element: '[data-tour="menu-tab-categories"]',
    popover: {
      title: 'Вкладка «Категории»',
      description: 'Откроем её — и увидим список всех разделов вашего меню.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="menu-tab-categories"]')?.click()
      await waitForElement('.categories-root')
    },
  },
  {
    element: '.categories-root',
    popover: {
      title: 'Категории',
      description: 'Категории — это разделы вашего меню: «Бургеры», «Напитки», «Десерты». Порядок можно менять перетаскиванием.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="add-category"]',
    popover: {
      title: 'Создать категорию',
      description: 'Эта кнопка открывает форму создания новой категории. Нажмите «Далее» чтобы посмотреть что внутри.',
      side: 'bottom',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-category"]')?.click()
      await waitForElement('[data-tour="category-name"]')
    },
  },
  {
    element: '[data-tour="category-photo"]',
    popover: {
      title: 'Фото категории',
      description: 'Необязательное поле. Фото отображается на сайте рядом с названием категории.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="category-name"]',
    popover: {
      title: 'Название',
      description: 'Обязательное поле. Именно это название увидят гости на сайте.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="category-type"]',
    popover: {
      title: 'Тип категории',
      description: '<b>Обычная</b> — стандартный список блюд, вы сами добавляете позиции.<br><br><b>Виртуальная</b> — блюда не добавляются вручную, категория автоматически показывает все блюда с определённым тегом из любых категорий. Удобно для «Новинок», «Хитов» и акционных позиций.<br><br><b>Комбо</b> — тенант собирает набор из нескольких блюд и предлагает гостю как единую позицию.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="category-save"]',
    popover: {
      title: 'Сохранить',
      description: 'Нажмите «Сохранить» — категория появится в списке и на сайте.',
      side: 'top',
      align: 'end',
    },
  },
]
