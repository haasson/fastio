import type { TourStep } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, clickAndWait, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'

export const getDishTourSteps = (): TourStep[] => [
  intro({
    title: 'Создание блюда',
    description: 'Покажем как добавить блюдо в меню шаг за шагом. Сначала перейдём в нужный раздел — нажмите «Далее».',
  }),
  navigateToMenuStep('menu-tab-dishes'),
  clickMenuTabStep({
    target: 'menu-tab-dishes',
    title: 'Вкладка «Блюда»',
    description: 'Основной список всех позиций вашего меню. Блюда всегда привязаны к категории.',
    waitTarget: 'add-dish',
    afterClick: () => {
      document.querySelector<HTMLElement>('[data-tour="category-tab"][data-category-type="regular"]')?.click()
    },
  }),
  highlight({
    target: '.categories-root',
    title: 'Категории',
    description: 'Блюда всегда привязаны к категории. Выберите нужную — список блюд откроется справа.',
    side: 'bottom',
  }),
  clickAndWait({
    target: 'add-dish',
    title: 'Создание блюда',
    description: 'Эта кнопка открывает форму создания нового блюда. Нажмите «Далее» чтобы посмотреть что внутри.',
    waitTarget: 'dish-photo',
  }),
  formField({
    target: 'dish-photo',
    title: 'Фото',
    description: 'Загрузите фото блюда. Конверсия в заказ заметно выше когда есть хорошее фото.',
  }),
  highlight({
    target: 'dish-main-fields',
    title: 'Основные поля',
    description: 'Название и цена — обязательные поля. Описание и вес опциональны, но помогают гостям с выбором.',
    side: 'left',
  }),
  highlight({
    target: 'dish-sections',
    title: 'Дополнительно',
    description: 'Раскрываемые секции: теги, модификаторы (размер, прожарка), добавки (соусы, топпинги) и КБЖУ. По каждой секции есть отдельный тур на странице «Помощь».',
    side: 'top',
  }),
  saveButton({
    target: 'dish-save',
    title: 'Сохранить',
    description: 'Нажмите «Сохранить» — блюдо сразу появится в меню на сайте.',
  }),
]
