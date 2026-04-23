import type { TourStep } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, clickAndWait, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'

export const getCategoryTourSteps = (): TourStep[] => {
  const l = useTenantLabels()
  const menuGen = l.menuPurposeGen.value // меню / каталога / списка услуг
  const itemsGen = l.itemsLabelGen.value // блюд / товаров / услуг
  const itemsLower = l.itemsLabelLower.value // блюда / товары / услуги
  const examples = l.categoryExamples.value

  return [
    intro({
      title: `Категории ${menuGen}`,
      description: `Сейчас покажем как создавать разделы ${menuGen}: ${examples}. Сначала перейдём в нужный раздел — нажмите «Далее».`,
    }),
    navigateToMenuStep('menu-tab-categories'),
    clickMenuTabStep({
      target: 'menu-tab-categories',
      title: 'Вкладка «Категории»',
      description: `Откроем её — и увидим список всех разделов вашего ${menuGen}.`,
      waitTarget: '.categories-root',
    }),
    highlight({
      target: '.categories-root',
      title: 'Категории',
      description: `Категории — это разделы вашего ${menuGen}: ${examples}. Порядок можно менять перетаскиванием.`,
      side: 'bottom',
    }),
    clickAndWait({
      target: 'add-category',
      title: 'Создать категорию',
      description: 'Эта кнопка открывает форму создания новой категории. Нажмите «Далее» чтобы посмотреть что внутри.',
      waitTarget: 'category-name',
    }),
    formField({
      target: 'category-photo',
      title: 'Фото категории',
      description: 'Необязательное поле. Фото отображается на сайте рядом с названием категории.',
    }),
    formField({
      target: 'category-name',
      title: 'Название',
      description: 'Обязательное поле. Именно это название увидят гости на сайте.',
    }),
    formField({
      target: 'category-type',
      title: 'Тип категории',
      description: `<b>Обычная</b> — стандартный список ${itemsGen}, вы сами добавляете позиции.<br><br><b>Виртуальная</b> — ${itemsLower} не добавляются вручную, категория автоматически показывает все ${itemsLower} с определённым тегом из любых категорий. Удобно для «Новинок», «Хитов» и акционных позиций.<br><br><b>Комбо</b> — собирает набор из нескольких ${itemsGen} и предлагает гостю как единую позицию.`,
    }),
    saveButton({
      target: 'category-save',
      title: 'Сохранить',
      description: 'Кнопка сохраняет категорию — она сразу появится в списке и на сайте.',
    }),
  ]
}
