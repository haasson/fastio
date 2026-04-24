import type { TourStep } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, clickAndWait, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'
import { useTerms } from '~/composables/useTerms'

export const getDishTourSteps = (): TourStep[] => {
  const { item, menu: menuVocab, menuStyle, isServices } = useTerms()
  const isFood = menuStyle === 'food' && !isServices

  return [
    intro({
      title: `${item.label}: создание`,
      description: `Покажем как добавить ${item.acc} в ${menuVocab.nom} шаг за шагом. Сначала перейдём в нужный раздел — нажмите «Далее».`,
    }),
    navigateToMenuStep('menu-tab-dishes'),
    clickMenuTabStep({
      target: 'menu-tab-dishes',
      title: `Вкладка «${item.plural.label}»`,
      description: `Основной список всех позиций вашего ${menuVocab.gen}. ${item.plural.label} всегда привязаны к категории.`,
      waitTarget: 'add-dish',
      afterClick: () => {
        document.querySelector<HTMLElement>('[data-tour="category-tab"][data-category-type="regular"]')?.click()
      },
    }),
    highlight({
      target: '.categories-root',
      title: 'Категории',
      description: `${item.plural.label} всегда привязаны к категории. Если выбрать нужную — список её ${item.plural.gen} откроется справа.`,
      side: 'bottom',
    }),
    clickAndWait({
      target: 'add-dish',
      title: `Создание ${item.gen}`,
      description: `Эта кнопка открывает форму создания. Нажмите «Далее» чтобы посмотреть что внутри.`,
      waitTarget: 'dish-photo',
    }),
    formField({
      target: 'dish-photo',
      title: 'Фото',
      description: `Здесь загружается фото ${item.gen}. Конверсия в заказ заметно выше когда есть хорошее фото.`,
    }),
    highlight({
      target: 'dish-main-fields',
      title: 'Основные поля',
      description: isFood
        ? 'Название и цена — обязательные поля. Описание и вес опциональны, но помогают гостям с выбором.'
        : 'Название и цена — обязательные поля. Описание опционально, но помогает с выбором.',
      side: 'left',
    }),
    highlight({
      target: 'dish-sections',
      title: 'Дополнительно',
      description: isFood
        ? 'Раскрываемые секции: теги, модификаторы (размер, прожарка), добавки (соусы, топпинги) и КБЖУ. По каждой секции есть отдельный тур на странице «Помощь».'
        : isServices
          ? 'Раскрываемые секции: теги и модификаторы (длительность, вариант). По каждой секции есть отдельный тур на странице «Помощь».'
          : 'Раскрываемые секции: теги, модификаторы (цвет, размер) и добавки. По каждой секции есть отдельный тур на странице «Помощь».',
      side: 'top',
    }),
    saveButton({
      target: 'dish-save',
      title: 'Сохранить',
      description: `Кнопка сохраняет ${item.acc} — ${item.pronoun.nom} сразу появится в ${menuVocab.pre} на сайте.`,
    }),
  ]
}
