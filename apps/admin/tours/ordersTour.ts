import type { TourStep } from '~/composables/useTour'
import { waitForElement } from '~/composables/useTour'
import { intro, highlight } from '~/tours/helpers'

export const getOrdersTourSteps = (): TourStep[] => [
  intro({
    title: 'Раздел «Заказы»',
    description: 'Раздел, в который вы будете заходить каждый день. Все входящие заказы — доставка, самовывоз, зал — попадают сюда в реальном времени.<br><br>Сейчас покажем как ориентироваться в интерфейсе. Нажмите «Далее» — перейдём в раздел.',
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
      await waitForElement('[data-tour="order-statuses-ready"]')
    },
  },
  highlight({
    target: '.statuses-root',
    title: 'Статусы заказов',
    description: 'Статусы — это воронка каждого заказа: «Новый» → «Готовится» → «Готов» → «Выдан». Число на каждом табе — количество заказов в нём прямо сейчас.<br><br>Если переключиться на другой таб — список заказов обновится.',
    side: 'bottom',
    align: 'start',
  }),
  {
    element: '[data-tour="order-view"]',
    popover: {
      title: 'Вид списка',
      description: '<b>Карточки</b> — удобно для оперативной работы: видно состав, клиента и кнопки смены статуса.<br><br><b>Таблица</b> — подходит для анализа: можно сортировать, фильтровать и выбирать несколько заказов сразу.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="add-order"]',
    popover: {
      title: 'Новый заказ вручную',
      description: 'Создайте заказ прямо из панели — когда клиент звонит по телефону или приходит к стойке.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '[data-tour="order-quick-actions"]',
    popover: {
      title: 'Быстрая смена статуса',
      description: 'Кнопки на карточке сразу переводят заказ в следующий статус — не нужно открывать детали. Набор кнопок меняется в зависимости от текущего статуса заказа.',
      side: 'top',
      align: 'start',
    },
    onNext: async () => {
      // элемент может отсутствовать если заказов нет — просто двигаемся дальше
    },
  },
  {
    popover: {
      title: 'Карточка заказа',
      description: 'Если открыть карточку — появится детальный вид: полный состав, адрес доставки, история статусов и поле для заметок.<br><br>Там же можно изменить состав, статус или распечатать чек.',
    },
  },
]
