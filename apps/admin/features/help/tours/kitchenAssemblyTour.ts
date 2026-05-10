import type { TourStep } from '~/composables/useTour'
import { intro, highlight, withEmptyHint, navigateToKitchenStep, clickKitchenTabStep } from '~/tours/helpers'

export const getKitchenAssemblyTourSteps = (): TourStep[] => [
  intro({
    title: 'Сборка заказов',
    description: 'Вкладка для сборщика на выдаче — здесь видно все активные заказы и статус каждого блюда. Когда кухня приготовила всё — собираешь заказ и отдаёшь клиенту.',
  }),
  navigateToKitchenStep('kitchen-tab-assembly'),
  clickKitchenTabStep({
    target: 'kitchen-tab-assembly',
    title: 'Вкладка «Сборка»',
    description: 'Нажмите «Далее» — перейдём.',
    waitTarget: 'kitchen-kanban',
  }),
  withEmptyHint(
    highlight({
      target: 'kitchen-assembly-cooking',
      title: 'Готовится на кухне',
      description: 'Заказы, в которых ещё не все позиции приготовлены. Счётчик показывает сколько таких заказов сейчас в работе.',
      side: 'right',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-assembly-cooking"] [data-tour="kitchen-assembly-card"]', hint: 'В этой колонке сейчас пусто — заказы появятся здесь когда повар возьмёт блюдо в работу.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-assembly-collecting',
      title: 'Требует сборки',
      description: 'Кухня приготовила всё — пора собирать. Счётчик оранжевый, требует внимания.<br><br>Карточка показывает позиции: что пришло с кухни и что нужно добавить самостоятельно (напитки, упаковка).',
      side: 'bottom',
      align: 'center',
    }),
    { checkSelector: '[data-tour="kitchen-assembly-collecting"] [data-tour="kitchen-assembly-card"]', hint: 'Здесь будут заказы у которых все блюда приготовлены и ждут сборки.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-assembly-ready',
      title: 'Готово',
      description: 'Заказы собраны и ждут выдачи. Счётчик зелёный. После нажатия «Собрано» заказ автоматически переходит в следующий статус — курьер забирает или клиент получает.',
      side: 'left',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-assembly-ready"] [data-tour="kitchen-assembly-card"]', hint: 'Здесь появятся заказы после того как сборщик нажмёт «Собрано».' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-assembly-card',
      title: 'Карточка заказа',
      description: 'Номер заказа, тип доставки и счётчик позиций. Когда все блюда приготовлены — появляется кнопка <b>«Собрано»</b>. Нажмите её — заказ уйдёт в нужный статус автоматически.',
      side: 'top',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-assembly-card"]', hint: 'Карточки заказов появятся здесь когда придут реальные заказы.' },
  ),
]
