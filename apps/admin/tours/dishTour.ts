import type { TourStep } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, clickAndWait, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'

export const getDishTourSteps = (): TourStep[] => {
  const l = useTenantLabels()
  const itemsLabel = l.itemsLabel.value // Блюда / Товары / Услуги
  const itemsGen = l.itemsLabelGen.value // блюд / товаров / услуг
  const itemAcc = l.itemAccLabel.value // блюдо / товар / услугу
  const itemGen = l.itemGen.value // блюда / товара / услуги
  const itemLabelCap = l.itemLabelCap.value // Блюдо / Товар / Услуга
  const menu = l.menuPurpose.value // меню / каталог / список услуг (вин./им.)
  const menuGen = l.menuPurposeGen.value // меню / каталога / списка услуг
  const menuLoc = l.menuPurposeLoc.value // меню / каталоге / списке услуг

  return [
    intro({
      title: `${itemLabelCap}: создание`,
      description: `Покажем как добавить ${itemAcc} в ${menu} шаг за шагом. Сначала перейдём в нужный раздел — нажмите «Далее».`,
    }),
    navigateToMenuStep('menu-tab-dishes'),
    clickMenuTabStep({
      target: 'menu-tab-dishes',
      title: `Вкладка «${itemsLabel}»`,
      description: `Основной список всех позиций вашего ${menuGen}. ${itemsLabel} всегда привязаны к категории.`,
      waitTarget: 'add-dish',
      afterClick: () => {
        document.querySelector<HTMLElement>('[data-tour="category-tab"][data-category-type="regular"]')?.click()
      },
    }),
    highlight({
      target: '.categories-root',
      title: 'Категории',
      description: `${itemsLabel} всегда привязаны к категории. Если выбрать нужную — список её ${itemsGen} откроется справа.`,
      side: 'bottom',
    }),
    clickAndWait({
      target: 'add-dish',
      title: `Создание ${itemGen}`,
      description: `Эта кнопка открывает форму создания. Нажмите «Далее» чтобы посмотреть что внутри.`,
      waitTarget: 'dish-photo',
    }),
    formField({
      target: 'dish-photo',
      title: 'Фото',
      description: `Здесь загружается фото ${itemGen}. Конверсия в заказ заметно выше когда есть хорошее фото.`,
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
      description: `Кнопка сохраняет ${itemAcc} — оно сразу появится в ${menuLoc} на сайте.`,
    }),
  ]
}
