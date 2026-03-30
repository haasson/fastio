import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'

export const getDishTourSteps = (): TourStep[] => [
  {
    popover: {
      title: 'Создание блюда',
      description: 'Покажем как добавить блюдо в меню шаг за шагом. Сначала перейдём в нужный раздел — нажмите «Далее».',
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
      await waitForElement('[data-tour="menu-tab-dishes"]')
    },
  },
  {
    element: '[data-tour="menu-tab-dishes"]',
    popover: {
      title: 'Вкладка «Блюда»',
      description: 'Основной список всех позиций вашего меню. Блюда всегда привязаны к категории.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="menu-tab-dishes"]')?.click()
      await waitForElement('[data-tour="category-tab"][data-category-type="regular"]')
      document.querySelector<HTMLElement>('[data-tour="category-tab"][data-category-type="regular"]')?.click()
      await waitForElement('[data-tour="add-dish"]')
    },
  },
  {
    element: '.categories-root',
    popover: {
      title: 'Категории',
      description: 'Блюда всегда привязаны к категории. Выберите нужную — список блюд откроется справа.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="add-dish"]',
    popover: {
      title: 'Создание блюда',
      description: 'Эта кнопка открывает форму создания нового блюда. Нажмите «Далее» чтобы посмотреть что внутри.',
      side: 'bottom',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-dish"]')?.click()
      await waitForElement('[data-tour="dish-photo"]')
    },
  },
  {
    element: '[data-tour="dish-photo"]',
    popover: {
      title: 'Фото',
      description: 'Загрузите фото блюда. Конверсия в заказ заметно выше когда есть хорошее фото.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dish-main-fields"]',
    popover: {
      title: 'Основные поля',
      description: 'Название и цена — обязательные поля. Описание и вес опциональны, но помогают гостям с выбором.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dish-sections"]',
    popover: {
      title: 'Дополнительно',
      description: 'Раскрываемые секции: теги, модификаторы (размер, прожарка), добавки (соусы, топпинги) и КБЖУ. По каждой секции есть отдельный тур на странице «Помощь».',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dish-save"]',
    popover: {
      title: 'Сохранить',
      description: 'Нажмите «Сохранить» — блюдо сразу появится в меню на сайте.',
      side: 'top',
      align: 'end',
    },
  },
]
