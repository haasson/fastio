import type { TourStep } from '../composables/useTour'
import { waitForElement } from '../composables/useTour'
import { intro, highlight, formField, saveButton, navigateToMenuStep, clickMenuTabStep } from './helpers'

export const getTagsTourSteps = (): TourStep[] => [
  intro({
    title: 'Теги',
    description: 'Теги — это метки, которые помогают гостям быстрее находить нужные позиции: «Острое», «Вегетарианское», «Хит продаж», «Новинка».<br><br>Они отображаются прямо на карточке блюда в витрине. Каждый тег — это название, иконка и цвет.',
  }),
  navigateToMenuStep('menu-tab-tags'),
  clickMenuTabStep({
    target: 'menu-tab-tags',
    title: 'Вкладка «Теги»',
    description: 'Здесь создаются и хранятся все теги. Нажмите «Далее» чтобы открыть.',
    waitTarget: '.tags-root',
  }),
  highlight({
    target: 'tags-list',
    title: 'Список тегов',
    description: 'Созданные теги видны здесь. Порядок меняется перетаскиванием — он же определяет порядок отображения в фильтрах на витрине.<br><br>Каждый тег можно отредактировать или удалить через кнопки справа.',
    side: 'bottom',
  }),
  {
    element: '[data-tour="add-tag"]',
    popover: {
      title: 'Создать тег',
      description: 'Нажмите «Далее» чтобы открыть форму создания тега.',
      side: 'bottom',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-tag"]')?.click()
      await waitForElement('[data-tour="tag-name"]')
    },
  },
  formField({
    target: 'tag-name',
    title: 'Название тега',
    description: 'Короткое и понятное — его увидит гость в витрине. Например: «Острое», «Вегетарианское», «Новинка», «Хит продаж».',
  }),
  formField({
    target: 'tag-icon',
    title: 'Иконка',
    description: 'Небольшая иконка, которая отображается рядом с названием тега на карточке блюда. Выберите ту, которая лучше всего передаёт смысл тега.',
  }),
  formField({
    target: 'tag-color',
    title: 'Цвет',
    description: 'Цвет фона и текста тега. Помогает визуально выделить разные категории: острое — красный, вегетарианское — зелёный и т.д.',
  }),
  formField({
    target: 'tag-preview',
    title: 'Превью',
    description: 'Так тег будет выглядеть на карточке блюда — сразу видно результат до сохранения.',
  }),
  saveButton({
    target: 'tag-save',
    title: 'Сохранить',
    description: 'После сохранения тег появится в списке. Назначайте его на блюда в форме редактирования блюда — в разделе «Теги».',
  }),
]
