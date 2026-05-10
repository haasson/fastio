import type { TourStep } from '../composables/useTour'
import { intro, highlight, navigateToKitchenStep, clickKitchenTabStep } from './helpers'

export const getKitchenSettingsTourSteps = (): TourStep[] => [
  intro({
    title: 'Настройки кухни',
    description: 'Нужно настроить один раз — без этого блюда не будут попадать в очередь. Здесь вы связываете кухонный модуль со статусами заказов и задаёте пороги срочности.',
  }),
  navigateToKitchenStep('kitchen-tab-settings'),
  clickKitchenTabStep({
    target: 'kitchen-tab-settings',
    title: 'Вкладка «Настройки»',
    description: 'Нажмите «Далее» — перейдём.',
    waitTarget: 'kitchen-setting-source-status',
  }),
  highlight({
    target: 'kitchen-setting-source-status',
    title: 'Статус для отправки на кухню',
    description: 'Ключевая настройка. Как только заказ переходит в этот статус — все его блюда появляются в очереди на вкладке «Кухня».<br><br>Обычно это «Принят» или «В работе».',
    side: 'bottom',
    align: 'start',
  }),
  highlight({
    target: 'kitchen-setting-cooking-status',
    title: 'Статус при начале готовки',
    description: 'Необязательное поле. Когда повар берёт первое блюдо из заказа — заказ автоматически переходит в этот статус.<br><br>Удобно если хотите отделять «Принят» от «Готовится».',
    side: 'bottom',
    align: 'start',
  }),
  highlight({
    target: 'kitchen-setting-completed-map',
    title: 'Статусы после сборки',
    description: 'Когда сборщик нажимает «Собрано» — заказ автоматически переходит в нужный статус. Можно задать разные статусы для доставки и самовывоза.<br><br>Например: доставка → «Ждёт курьера», самовывоз → «Готов к выдаче».',
    side: 'bottom',
    align: 'start',
  }),
  highlight({
    target: 'kitchen-setting-urgency',
    title: 'Порог срочности',
    description: 'Через сколько минут карточка начнёт желтеть (66% времени) и краснеть (100%). По умолчанию 15 минут.<br><br>Поставьте столько, сколько реально нужно на приготовление самого долгого блюда.',
    side: 'right',
    align: 'start',
  }),
  {
    popover: {
      title: 'Готово',
      description: 'Настройки сохранены — теперь создайте тестовый заказ и переведите его в нужный статус. Блюда сразу появятся в очереди на вкладке «Кухня».',
    },
  },
]
