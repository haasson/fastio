import type { TourStep } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, clickAndWait, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'

export const getCategoryTourSteps = (): TourStep[] => [
  intro({
    title: 'Категории меню',
    description: 'Сейчас покажем как создавать разделы меню: «Бургеры», «Напитки», «Десерты». Сначала перейдём в нужный раздел — нажмите «Далее».',
  }),
  navigateToMenuStep('menu-tab-categories'),
  clickMenuTabStep({
    target: 'menu-tab-categories',
    title: 'Вкладка «Категории»',
    description: 'Откроем её — и увидим список всех разделов вашего меню.',
    waitTarget: '.categories-root',
  }),
  highlight({
    target: '.categories-root',
    title: 'Категории',
    description: 'Категории — это разделы вашего меню: «Бургеры», «Напитки», «Десерты». Порядок можно менять перетаскиванием.',
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
    description: '<b>Обычная</b> — стандартный список блюд, вы сами добавляете позиции.<br><br><b>Виртуальная</b> — блюда не добавляются вручную, категория автоматически показывает все блюда с определённым тегом из любых категорий. Удобно для «Новинок», «Хитов» и акционных позиций.<br><br><b>Комбо</b> — тенант собирает набор из нескольких блюд и предлагает гостю как единую позицию.',
  }),
  saveButton({
    target: 'category-save',
    title: 'Сохранить',
    description: 'Нажмите «Сохранить» — категория появится в списке и на сайте.',
  }),
]
