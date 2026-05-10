import type { TourStep } from '../composables/useTour'
import { intro, highlight, withEmptyHint, navigateToKitchenStep, clickKitchenTabStep } from './helpers'

export const getKitchenOverviewTourSteps = (): TourStep[] => [
  intro({
    title: 'Обзор кухни',
    description: 'Вкладка для менеджера — здесь видно всё что происходит на кухне прямо сейчас: очередь, что готовится, что зависло. Помогает контролировать загрузку и замечать проблемы.',
  }),
  navigateToKitchenStep('kitchen-tab-overview'),
  clickKitchenTabStep({
    target: 'kitchen-tab-overview',
    title: 'Вкладка «Обзор»',
    description: 'Нажмите «Далее» — перейдём.',
    waitTarget: 'kitchen-stat-cards',
  }),
  withEmptyHint(
    highlight({
      target: 'kitchen-stat-cards',
      title: 'Фильтры-счётчики',
      description: 'Карточки показывают количество блюд в каждом состоянии: очередь, в работе, готово. Нажмите на любую — таблица отфильтруется. Нажмите снова — фильтр снимется.',
      side: 'bottom',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-overview"] .n-data-table-tr', hint: 'Сейчас нет активных блюд. Создайте тестовый заказ и переведите его в статус отправки на кухню — счётчики и таблица заполнятся.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-stat-warning',
      title: 'Срочные',
      description: 'Блюда прошли 66% порога срочности — повар занят, но время ещё есть. Жёлтая рамка на карточке.',
      side: 'bottom',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-stat-warning"]', hint: 'Срочных блюд сейчас нет — карточка появится когда блюдо пролежит в очереди достаточно долго.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-stat-critical',
      title: 'Критичные',
      description: 'Блюда на 100% и больше порога — нужно вмешаться. Красная рамка, пульсирующий таймер. Кто-то застрял или забыл нажать «Готово».',
      side: 'bottom',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-stat-critical"]', hint: 'Критичных блюд нет — это хорошо. Карточка появится при превышении порога срочности.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-overview',
      title: 'Таблица блюд',
      description: 'Все активные блюда: название, номер заказа, таймер ожидания, статус, тип доставки. Позволяет быстро найти конкретное блюдо и понять на каком оно этапе.',
      side: 'top',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-overview"] .n-data-table-tr', hint: 'Таблица пуста — создайте тестовый заказ и переведите его в нужный статус, чтобы увидеть таблицу в работе.' },
  ),
]
