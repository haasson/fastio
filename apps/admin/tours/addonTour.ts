import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'
import { intro, highlight, formField, saveButton, navigateToMenuStep, clickMenuTabStep } from '~/tours/helpers'

export const getAddonTourSteps = (): TourStep[] => [
  intro({
    title: 'Добавки',
    description: 'Добавки — это отдельные позиции, которые гость может добавить к блюду: соусы, топпинги, дополнительные ингредиенты.<br><br>Отличие от модификаторов: в модификаторе гость выбирает <b>один</b> вариант из группы (маленькая <i>или</i> большая). Добавки комбинируются свободно — можно взять и халапеньо, и барбекю, и дополнительный сыр одновременно.',
  }),
  navigateToMenuStep('menu-tab-addons'),
  clickMenuTabStep({
    target: 'menu-tab-addons',
    title: 'Вкладка «Добавки»',
    description: 'Здесь хранятся все добавки и пресеты. Нажмите «Далее» чтобы открыть.',
    waitTarget: '.addons-root',
  }),
  highlight({
    target: 'addon-max-setting',
    title: 'Ограничение количества',
    description: 'Опциональная настройка: сколько добавок гость может выбрать к одному блюду. Если не включать — гость выбирает без ограничений.',
    side: 'bottom',
  }),
  {
    element: '[data-tour="addon-tab-addons"]',
    popover: {
      title: 'Вкладка «Добавки»',
      description: 'Список отдельных добавок. Каждая добавка — самостоятельная позиция с названием, ценой и весом. Нажмите «Далее» чтобы посмотреть форму.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-addon"]')?.click()
      await waitForElement('[data-tour="addon-name"]')
    },
  },
  formField({
    target: 'addon-name',
    title: 'Название добавки',
    description: 'Понятное название, которое увидит гость. Например: «Соус барбекю», «Дополнительный сыр», «Халапеньо».',
  }),
  formField({
    target: 'addon-price-weight',
    title: 'Цена и вес',
    description: '<b>Цена</b> — доплата за добавку, прибавляется к стоимости блюда. Ноль — если добавка бесплатная.<br><br><b>Вес</b> — опциональное поле, учитывается в итоговом весе блюда.',
  }),
  {
    element: '[data-tour="addon-save"]',
    popover: {
      title: 'Сохранить добавку',
      description: 'После сохранения добавку можно привязать к блюдам напрямую или через пресет.<br><br>Нажмите «Далее» — покажем как работают пресеты.',
      side: 'top',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="addon-cancel"]')?.click()
      document.querySelector<HTMLElement>('[data-tour="addon-tab-presets"]')?.click()
      await waitForElement('[data-tour="addon-tab-presets"]')
    },
  },
  {
    element: '[data-tour="addon-tab-presets"]',
    popover: {
      title: 'Пресеты',
      description: 'Пресет — это именованный набор добавок. Создайте «Острый набор» из халапеньо, чили и барбекю — и одним действием назначайте его на любые блюда.<br><br>Без пресетов пришлось бы добавлять каждую из этих добавок к каждому блюду по отдельности. Нажмите «Далее» чтобы посмотреть форму.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-addon"]')?.click()
      await waitForElement('[data-tour="preset-name"]')
    },
  },
  formField({
    target: 'preset-name',
    title: 'Название пресета',
    description: 'Назовите набор понятно для себя: «Острый», «Сырный», «Классический». Гость это не видит — название нужно только вам для удобства.',
  }),
  formField({
    target: 'preset-addons',
    title: 'Состав пресета',
    description: 'Отметьте добавки, которые войдут в этот набор. Когда назначаете пресет на блюдо, все эти добавки автоматически становятся доступны гостю.',
  }),
  saveButton({
    target: 'preset-save',
    title: 'Сохранить пресет',
    description: 'После сохранения пресет появится в форме редактирования блюда в разделе «Добавки» — выберите его и все нужные добавки подключатся разом.',
  }),
]
