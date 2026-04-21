import type { TourStep } from '~/composables/useTour'
import { intro, highlight, navigateToOrdersStep, clickOrdersTabStep } from '~/tours/helpers'

export const getOrderSettingsTourSteps = (): TourStep[] => [
  intro({
    title: 'Предзаказ',
    description: 'По умолчанию клиент оформляет заказ «как можно скорее». Но если включить предзаказ — он сможет выбрать конкретное время: на сегодня вечером или на завтра к обеду.<br><br>Разберём как это настроить.',
  }),
  navigateToOrdersStep('orders-tab-settings'),
  clickOrdersTabStep({
    target: 'orders-tab-settings',
    title: 'Вкладка «Настройки»',
    description: 'Настройки предзаказа. Нажмите «Далее».',
    waitTarget: 'preorder-toggle',
  }),
  highlight({
    target: 'preorder-toggle',
    title: 'Включить предзаказ',
    description: 'Когда переключатель выключен — клиент всегда заказывает «сейчас». После включения появляется выбор времени и дополнительные настройки ниже.<br><br>Удобно для пиццерий, кондитерских и корпоративных заказов.',
    side: 'right',
    align: 'center',
  }),
  highlight({
    target: 'preorder-slots',
    title: 'Доступные даты и шаг слотов',
    description: '<b>Дней вперёд</b> — как далеко клиент может выбрать время. Например, 3 — значит сегодня, завтра и послезавтра.<br><br><b>Шаг слотов</b> — интервал между доступными временами: 15, 30 или 60 минут. Чем меньше шаг — тем точнее выбор, но тем больше вариантов видит клиент.',
    side: 'right',
    align: 'center',
  }),
  highlight({
    target: 'preorder-buffers',
    title: 'Буферы',
    description: '<b>Буфер при закрытии</b> — за сколько минут до конца рабочего дня исчезают последние слоты. Чтобы кухня успела приготовить.<br><br><b>Буфер при открытии</b> — минимальный интервал от текущего момента до ближайшего слота. Например, 60 минут — клиент не увидит время раньше чем через час.',
    side: 'right',
    align: 'center',
  }),
]
