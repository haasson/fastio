import type { TourStep } from '../composables/useTour'
import { waitForElement } from '../composables/useTour'
import { intro, highlight, navigateToOrdersStep, clickOrdersTabStep } from './helpers'

export const getStatusesTourSteps = (): TourStep[] => [
  intro({
    title: 'Статусы заказов',
    description: 'Статусы — это путь каждого заказа от поступления до выдачи. Вы можете создавать свои статусы, задавать им названия и выстраивать логику переходов.<br><br>Разберём весь процесс по шагам.',
  }),
  navigateToOrdersStep('orders-tab-statuses'),
  clickOrdersTabStep({
    target: 'orders-tab-statuses',
    title: 'Вкладка «Статусы»',
    description: 'Здесь управляются все статусы заказов. Нажмите «Далее» — перейдём.',
    waitTarget: 'orders-statuses-add',
  }),
  highlight({
    target: 'orders-status-list',
    title: 'Список статусов',
    description: 'Каждый статус принадлежит одной из четырёх <b>групп</b>:<br><br>• <b>Новый</b> — заказ только поступил, ждёт подтверждения<br>• <b>В процессе</b> — принят, кухня готовит<br>• <b>Выполнен</b> — завершён успешно<br>• <b>Отменён</b> — отклонён или отменён клиентом<br><br>Группа влияет на поведение системы: аналитику, уведомления, а если подключён модуль кухни — то и на попадание заказа в очередь. Перетащите строку чтобы изменить порядок статусов.',
    side: 'top',
    align: 'start',
  }),
  {
    element: '[data-tour="orders-statuses-add"]',
    popover: {
      title: 'Создать статус',
      description: 'Нажмите «Далее» — откроем форму создания статуса.',
      side: 'bottom',
      align: 'end',
    },
    onNext: async () => {
      document.querySelector<HTMLElement>('[data-tour="orders-statuses-add"]')?.click()
      await waitForElement('[data-tour="status-form-name"]')
    },
  },
  highlight({
    target: 'status-form-name',
    title: 'Название',
    description: 'Придумайте понятное название — оно будет видно сотрудникам в интерфейсе. Например: «Ожидает курьера», «Отложен», «Готовится».',
    side: 'right',
    align: 'center',
  }),
  highlight({
    target: 'status-form-group',
    title: 'Группа',
    description: 'Выберите к какой группе относится статус:<br><br>• <b>Новый</b> — заказ ещё не принят в работу<br>• <b>В процессе</b> — кухня готовит<br>• <b>Выполнен</b> — заказ закрыт успешно<br>• <b>Отменён</b> — заказ отклонён или отменён<br><br>Это не просто метка — группа определяет поведение в системе: аналитику, уведомления и (если подключён модуль кухни) попадание в очередь приготовления.',
    side: 'right',
    align: 'center',
  }),
  highlight({
    target: 'status-form-actions',
    title: 'Быстрые действия',
    description: 'Кнопки перехода в другой статус прямо с карточки заказа — без открытия детального вида. Например, у статуса «Новый» — кнопка «Принять», у «В процессе» — кнопка «Выполнен».<br><br>Можно задать до двух кнопок. У групп «Выполнен» и «Отменён» быстрых действий нет — это терминальные состояния.',
    side: 'right',
    align: 'center',
  }),
  {
    element: '.modal-actions',
    popover: {
      title: 'Сохранить',
      description: 'Заполните форму и нажмите <b>Сохранить</b>. Новый статус сразу появится в списке и начнёт применяться к заказам.',
      side: 'top',
      align: 'end',
    },
  },
]
