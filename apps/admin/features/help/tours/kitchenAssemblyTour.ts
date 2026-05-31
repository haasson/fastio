import type { TourStep } from '../composables/useTour'
import { intro, highlight, withEmptyHint, navigateToKitchenStep, clickKitchenTabStep } from './helpers'

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
      target: 'kitchen-assembly-ready',
      title: 'Готово',
      description: 'Кухня приготовила всё — пора собирать и выдавать. Карточка показывает позиции: что пришло с кухни и что нужно добавить самостоятельно (напитки, упаковка). Отметьте собранные позиции, затем нажмите «Собрано» — заказ автоматически уйдёт в следующий статус: курьер забирает или клиент получает.',
      side: 'left',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-assembly-ready"] [data-tour="kitchen-assembly-card"]', hint: 'Здесь будут заказы у которых все блюда приготовлены — их нужно собрать и выдать.' },
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
