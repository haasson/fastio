import type { TourStep } from '~/composables/useTour'
import { intro, highlight, navigateToOrdersStep, clickOrdersTabStep } from '~/tours/helpers'

export const getDeliveryTourSteps = (): TourStep[] => [
  intro({
    title: 'Настройка доставки',
    description: 'Здесь настраивается география и стоимость доставки — два режима на выбор: фиксированная цена для всех или зоны с индивидуальными условиями.<br><br>Покажем как это работает.',
  }),
  navigateToOrdersStep('orders-tab-delivery'),
  clickOrdersTabStep({
    target: 'orders-tab-delivery',
    title: 'Вкладка «Доставка»',
    description: 'Конфигурация доставки. Нажмите «Далее».',
    waitTarget: '.mode-switch',
  }),
  highlight({
    target: '.mode-switch',
    title: 'Режим доставки',
    description: '<b>Фикс. стоимость</b> — одна цена для всех адресов. Настраивается единое значение и порог бесплатной доставки.<br><br><b>Зоны доставки</b> — рисуете полигоны на карте, для каждой зоны задаёте свою стоимость, минимальный заказ и порог бесплатной доставки. Если адрес клиента вне зон — заказ не принимается.',
    side: 'bottom',
    align: 'start',
  }),
  highlight({
    target: 'delivery-zone-tiles',
    title: 'Тайлы зон',
    description: 'Здесь видны все зоны по филиалам. Кликните на зону — откроется форма редактирования прямо поверх карты.<br><br>Если у филиала нет ни одной зоны — он подсвечивается красной рамкой: доставка для него будет недоступна клиентам.',
    side: 'bottom',
    align: 'start',
  }),
  highlight({
    target: '.zones-map',
    title: 'Карта зон',
    description: 'Нажмите «Нарисовать зону» на карте — и кликайте по точкам чтобы обозначить границы полигона. Двойной клик завершает рисование.<br><br>После этого справа откроется панель: задайте название, цвет, стоимость доставки, минимальную сумму заказа и порог бесплатной доставки.',
    side: 'left',
    align: 'center',
  }),
]
