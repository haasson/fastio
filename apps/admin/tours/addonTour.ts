import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'

export const getAddonTourSteps = (): TourStep[] => [
  {
    popover: {
      title: 'Добавки',
      description: 'Добавки — это отдельные позиции, которые гость может добавить к блюду: соусы, топпинги, дополнительные ингредиенты.<br><br>Отличие от модификаторов: в модификаторе гость выбирает <b>один</b> вариант из группы (маленькая <i>или</i> большая). Добавки комбинируются свободно — можно взять и халапеньо, и барбекю, и дополнительный сыр одновременно.',
    },
  },
  {
    element: 'a[href="/menu"]',
    popover: {
      title: 'Раздел «Меню»',
      description: 'Здесь находится всё управление меню — блюда, категории, модификаторы и добавки. Нажмите «Далее» чтобы перейти.',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/menu"]')?.click()
      await waitForElement('[data-tour="menu-tab-addons"]')
    },
  },
  {
    element: '[data-tour="menu-tab-addons"]',
    popover: {
      title: 'Вкладка «Добавки»',
      description: 'Здесь хранятся все добавки и пресеты. Нажмите «Далее» чтобы открыть.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="menu-tab-addons"]')?.click()
      await waitForElement('.addons-root')
    },
  },
  {
    element: '[data-tour="addon-max-setting"]',
    popover: {
      title: 'Ограничение количества',
      description: 'Опциональная настройка: сколько добавок гость может выбрать к одному блюду. Если не включать — гость выбирает без ограничений.',
      side: 'bottom',
      align: 'start',
    },
  },
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
  {
    element: '[data-tour="addon-name"]',
    popover: {
      title: 'Название добавки',
      description: 'Понятное название, которое увидит гость. Например: «Соус барбекю», «Дополнительный сыр», «Халапеньо».',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="addon-price-weight"]',
    popover: {
      title: 'Цена и вес',
      description: '<b>Цена</b> — доплата за добавку, прибавляется к стоимости блюда. Ноль — если добавка бесплатная.<br><br><b>Вес</b> — опциональное поле, учитывается в итоговом весе блюда.',
      side: 'right',
      align: 'start',
    },
  },
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
  {
    element: '[data-tour="preset-name"]',
    popover: {
      title: 'Название пресета',
      description: 'Назовите набор понятно для себя: «Острый», «Сырный», «Классический». Гость это не видит — название нужно только вам для удобства.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="preset-addons"]',
    popover: {
      title: 'Состав пресета',
      description: 'Отметьте добавки, которые войдут в этот набор. Когда назначаете пресет на блюдо, все эти добавки автоматически становятся доступны гостю.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="preset-save"]',
    popover: {
      title: 'Сохранить пресет',
      description: 'После сохранения пресет появится в форме редактирования блюда в разделе «Добавки» — выберите его и все нужные добавки подключатся разом.',
      side: 'top',
      align: 'end',
    },
  },
]
