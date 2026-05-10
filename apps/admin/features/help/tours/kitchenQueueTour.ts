import type { TourStep } from '../composables/useTour'
import { intro, highlight, withEmptyHint, navigateToKitchenStep, clickKitchenTabStep } from './helpers'

export const getKitchenQueueTourSteps = (): TourStep[] => [
  intro({
    title: 'Кухонная очередь',
    description: 'Рабочее место повара — блюда из входящих заказов появляются здесь в реальном времени. Каждое блюдо — отдельная карточка: берёшь в работу, готовишь, отмечаешь готовым.<br><br>Покажем как это работает.',
  }),
  navigateToKitchenStep('kitchen-tab-queue'),
  clickKitchenTabStep({
    target: 'kitchen-tab-queue',
    title: 'Вкладка «Кухня»',
    description: 'Основная вкладка для поваров. Нажмите «Далее» — перейдём.',
    waitTarget: 'kitchen-queue',
  }),
  {
    element: '[data-tour="kitchen-queue-filter"]',
    popover: {
      title: 'Фильтр по категориям',
      description: 'Если на кухне несколько поваров — каждый может выбрать свои категории. Повар суши видит только суши, пиццайоло — только пиццу. По умолчанию показываются все категории.',
      side: 'bottom',
      align: 'start',
    },
  },
  withEmptyHint(
    highlight({
      target: 'kitchen-queue-panel',
      title: 'Очередь',
      description: 'Левая панель — новые блюда ожидают повара. Карточки появляются здесь как только заказ переходит в нужный статус.<br><br>Таймер показывает сколько блюдо ждёт: желтеет на 66% порога срочности, краснеет на 100%.',
      side: 'right',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-queue-item"]', hint: 'Очередь сейчас пуста. Создайте тестовый заказ и переведите его в статус «отправки на кухню» — блюда появятся здесь. После этого можно перезапустить тур.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-queue-item',
      title: 'Карточка блюда',
      description: 'Название, таймер ожидания и кнопка <b>«Взять»</b>. Нажмите «Взять» — блюдо перейдёт в правую панель и закрепится за вами.',
      side: 'right',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-queue-item"]', hint: 'Блюд в очереди нет — карточки появятся когда придут реальные заказы.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-work-panel',
      title: 'Мои блюда',
      description: 'Правая панель — ваши блюда в работе. Здесь видно все что вы взяли: состав, модификаторы, добавки, убранные ингредиенты.',
      side: 'left',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-work-card"]', hint: 'Вы ещё не взяли ни одного блюда — нажмите «Взять» на карточке в очереди слева.' },
  ),
  withEmptyHint(
    highlight({
      target: 'kitchen-work-card',
      title: 'Карточка в работе',
      description: '<b>«Готово»</b> — блюдо приготовлено, уходит на сборку заказа.<br><b>«Вернуть»</b> — если ошиблись, блюдо вернётся в общую очередь.<br><br>Если заказ отменили пока вы готовили — карточка подсветится красным с кнопкой «Убрать».',
      side: 'left',
      align: 'start',
    }),
    { checkSelector: '[data-tour="kitchen-work-card"]', hint: 'Здесь появятся блюда которые вы взяли в работу.' },
  ),
]
