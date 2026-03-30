import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'

export const getModifierTourSteps = (): TourStep[] => [
  {
    popover: {
      title: 'Модификаторы',
      description: 'Разберёмся с модификаторами — группами вариантов для блюд: «Размер», «Тесто», «Прожарка». Сначала перейдём в нужный раздел.',
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
      await waitForElement('[data-tour="menu-tab-modifiers"]')
    },
  },
  {
    element: '[data-tour="menu-tab-modifiers"]',
    popover: {
      title: 'Вкладка «Модификаторы»',
      description: 'Здесь создаются и хранятся все группы вариантов. Нажмите «Далее» чтобы открыть.',
      side: 'bottom',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="menu-tab-modifiers"]')?.click()
      await waitForElement('.modifiers-root')
    },
  },
  {
    element: '.modifiers-root',
    popover: {
      title: 'Список модификаторов',
      description: 'Модификатор — это группа взаимоисключающих вариантов блюда, которую гость выбирает при заказе.<br><br>Примеры: <b>Размер</b> (Маленькая / Средняя / Большая), <b>Тесто</b> (Тонкое / Пышное), <b>Прожарка</b> (Слабая / Средняя / Сильная).<br><br>Каждая группа создаётся один раз и затем привязывается к нужным блюдам.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="add-modifier"]',
    popover: {
      title: 'Создать группу',
      description: 'Нажмите «Далее» чтобы посмотреть форму создания группы модификаторов.',
      side: 'bottom',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="add-modifier"]')?.click()
      await waitForElement('[data-tour="modifier-name"]')
    },
  },
  {
    element: '[data-tour="modifier-name"]',
    popover: {
      title: 'Название группы',
      description: 'Называйте группу понятно — это увидит гость при выборе. Например: «Размер», «Бортик», «Степень остроты».',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="modifier-active"]',
    popover: {
      title: 'Активна',
      description: 'Включает или выключает показ этой группы гостям. Неактивную группу можно держать про запас — она не будет отображаться в меню, но сохранится со всеми настройками.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="modifier-affects-weight"]',
    popover: {
      title: 'Влияет на вес',
      description: 'Включите, если разные варианты группы меняют итоговый вес блюда. Например, пицца 25 см и 35 см весят по-разному.<br><br>Нажмите «Далее» — включим этот режим и посмотрим как задать вес.',
      side: 'right',
      align: 'start',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="modifier-affects-weight"]')?.click()
      document.querySelector<HTMLElement>('[data-tour="modifier-add-option"]')?.click()
      await waitForElement('[data-tour="modifier-weight-mode"]')
    },
  },
  {
    element: '[data-tour="modifier-weight-mode"]',
    popover: {
      title: 'Где задавать вес',
      description: '<b>На уровне модификатора</b> — вес одинаковый для всех блюд, которые используют эту группу. Задаётся прямо здесь, рядом с каждой опцией.<br><br><b>Каждое блюдо своё</b> — вес задаётся отдельно для каждого блюда в форме его редактирования. Подходит, если у разных блюд с одним размером разный вес.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="modifier-options"]',
    popover: {
      title: 'Опции',
      description: 'Это варианты внутри группы. Для «Размера» — «Маленькая», «Средняя», «Большая».<br><br>Рядом с каждой опцией поле веса — заполните его в граммах или миллилитрах. Доплату к цене можно задать позже, прямо в форме редактирования блюда.<br><br>Порядок опций меняется перетаскиванием за иконку.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="modifier-save"]',
    popover: {
      title: 'Сохранить',
      description: 'После сохранения группу можно привязать к любым блюдам — в форме редактирования блюда в разделе «Модификаторы».',
      side: 'top',
      align: 'end',
    },
  },
]
