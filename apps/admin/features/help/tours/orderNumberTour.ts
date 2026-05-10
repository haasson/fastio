import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'
import { intro, highlight, clickOrdersTabStep } from '~/tours/helpers'

export const getOrderNumberTourSteps = (): TourStep[] => [
  intro({
    title: 'Нумерация заказов',
    description: 'Каждый заказ получает свой номер — он отображается клиенту и на кухне. Вы можете настроить формат под нужды своего заведения.<br><br>Разберём все опции.',
  }),
  {
    element: 'a[href="/orders"]',
    popover: {
      title: 'Раздел «Заказы»',
      description: 'Переходим. Нажмите «Далее».',
      side: 'right',
      align: 'center',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('a[href="/orders"]')?.click()
      await waitForElement('[data-tour="orders-tab-number"]')
    },
  },
  clickOrdersTabStep({
    target: 'orders-tab-number',
    title: 'Вкладка «Нумерация»',
    description: 'Настройки формата номера заказа. Нажмите «Далее».',
    waitTarget: 'order-format',
  }),
  highlight({
    target: 'order-format',
    title: 'Формат номера',
    description: 'Четыре варианта:<br><br>• <b>Счётчик</b> — просто 1042<br>• <b>Префикс + счётчик</b> — ORD-1042<br>• <b>Дата + счётчик</b> — 2303-042<br>• <b>Префикс + дата + счётчик</b> — ORD-2303-042<br><br>Чем проще — тем меньше путаницы на кухне.',
    side: 'right',
    align: 'start',
  }),
  highlight({
    target: 'order-scope',
    title: 'Сквозная нумерация или по филиалам',
    description: '<b>Сквозная</b> — единый счётчик для всех точек. Удобно если один центральный учёт.<br><br><b>По филиалам</b> — у каждой точки свой счётчик и свой префикс. Префикс задаётся в настройках конкретного филиала.',
    side: 'right',
    align: 'start',
  }),
  highlight({
    target: 'order-reset',
    title: 'Сброс счётчика',
    description: '<b>Никогда</b> — счётчик растёт бесконечно. Подходит большинству заведений.<br><br><b>Ежедневно</b> — обнуляется каждую ночь. Имеет смысл если в номере есть дата — тогда 042 сегодня и 042 завтра не перепутаются.',
    side: 'right',
    align: 'start',
  }),
  highlight({
    target: 'order-pad',
    title: 'Нули слева и начальный счётчик',
    description: '<b>Нули слева</b> — выравнивание номера по длине. 0 — без нулей (1042), 4 — с нулями (1042 → 1042, но 42 → 0042).<br><br><b>Начать с</b> — стартовое значение счётчика. Полезно если переносите базу из другой системы и хотите продолжить нумерацию.',
    side: 'right',
    align: 'start',
  }),
  highlight({
    target: '.preview',
    title: 'Предпросмотр',
    description: 'Пример номера обновляется в реальном времени — сразу видно как будет выглядеть результат.',
    side: 'top',
    align: 'start',
  }),
]
