import type { PermissionKey } from '@fastio/shared'

export type PermissionGroup = {
  label: string
  permissions: { key: PermissionKey; label: string }[]
}

export type PermissionGroupOptions = {
  auditLogEnabled: boolean
}

export const getPermissionGroups = ({ auditLogEnabled }: PermissionGroupOptions): PermissionGroup[] => [
  {
    label: 'Меню',
    permissions: [
      { key: 'menu.view', label: 'Просмотр меню' },
      { key: 'menu.edit', label: 'Редактирование меню' },
      { key: 'menu.delete', label: 'Удаление позиций' },
    ],
  },
  {
    label: 'Заказы',
    permissions: [
      { key: 'orders.view', label: 'Просмотр заказов' },
      { key: 'orders.create', label: 'Приём заказов' },
      { key: 'orders.edit', label: 'Изменение заказа' },
      { key: 'orders.status', label: 'Изменение статуса' },
      { key: 'orders.cancel', label: 'Отмена заказов' },
    ],
  },
  {
    label: 'Кухня',
    permissions: [
      { key: 'kitchen.view', label: 'Доступ к кухонной очереди' },
      { key: 'kitchen.cook', label: 'Готовка (брать блюда в работу)' },
      { key: 'kitchen.overview', label: 'Обзор всей кухни (для менеджеров)' },
    ],
  },
  {
    label: 'Столы',
    permissions: [
      { key: 'tables.view', label: 'Просмотр столов, вызовов и броней' },
      { key: 'tables.manage', label: 'Управление столами и бронями' },
      { key: 'tables.history', label: 'Просмотр истории столов' },
    ],
  },
  {
    label: 'Онлайн-запись',
    permissions: [
      { key: 'appointments.view', label: 'Просмотр записей' },
      { key: 'appointments.manage', label: 'Управление записями' },
      { key: 'appointments.view_all', label: 'Видеть таймлайн всех исполнителей' },
      { key: 'appointments.view_own', label: 'Видеть таймлайн только своего ресурса' },
    ],
  },
  {
    label: 'Промоакции',
    permissions: [
      { key: 'promos.view', label: 'Просмотр промоакций' },
      { key: 'promos.manage', label: 'Управление промоакциями' },
    ],
  },
  {
    label: 'Контент и сайт',
    permissions: [
      { key: 'content.view', label: 'Просмотр контента и оформления' },
      { key: 'content.edit', label: 'Редактирование контента и оформления' },
    ],
  },
  {
    label: 'Команда',
    permissions: [
      { key: 'team.view', label: 'Просмотр команды' },
      { key: 'team.manage', label: 'Управление командой' },
      { key: 'roles.manage', label: 'Управление ролями' },
    ],
  },
  {
    label: 'Настройки',
    permissions: [
      { key: 'settings.view', label: 'Просмотр настроек' },
      { key: 'settings.edit', label: 'Редактирование настроек' },
      ...(auditLogEnabled ? [{ key: 'audit_log.view' as PermissionKey, label: 'Просмотр журнала действий' }] : []),
    ],
  },
  {
    label: 'Аналитика',
    permissions: [
      { key: 'analytics.view', label: 'Просмотр аналитики' },
    ],
  },
  {
    label: 'Биллинг',
    permissions: [
      { key: 'billing.manage', label: 'Управление биллингом' },
    ],
  },
]

// ─────────────────────────────────────
// Пресеты ролей — заготовки прав «в один клик» при создании кастомной роли.
// Дополняют дефолтные generic-роли (Администратор/Менеджер/Сотрудник) узкими
// job-specific шаблонами. Клик по пресету в форме ЗАМЕНЯЕТ матрицу прав.
// ─────────────────────────────────────

export type RolePreset = {
  key: string
  name: string
  description: string
  permissions: PermissionKey[]
}

export type RolePresetOptions = {
  isServices: boolean
  isRetail: boolean
}

// Зоны заказов разделены: зал (dine_in) живёт под tables.*, навынос/доставка — под
// orders.*. Готовка — отдельное право kitchen.cook (взять блюдо в работу), просмотр
// очереди — kitchen.view.
const RETAIL_PRESETS: RolePreset[] = [
  {
    key: 'cook',
    name: 'Повар',
    description: 'Кухонная очередь и готовка',
    permissions: ['menu.view', 'kitchen.view', 'kitchen.cook'],
  },
  {
    key: 'assembler',
    name: 'Сборщик',
    description: 'Сборка заказов навынос (без готовки)',
    permissions: ['kitchen.view', 'orders.view', 'orders.status'],
  },
  {
    key: 'courier',
    name: 'Курьер',
    description: 'Доставка заказов',
    permissions: ['orders.view', 'orders.status'],
  },
  {
    key: 'waiter',
    name: 'Официант / Хостес',
    description: 'Зал, столы и брони',
    permissions: ['tables.view', 'tables.manage'],
  },
  {
    key: 'cashier',
    name: 'Кассир',
    description: 'Приём заказов навынос и на доставку',
    permissions: ['menu.view', 'orders.view', 'orders.create', 'orders.edit', 'orders.status'],
  },
]

const SERVICES_PRESETS: RolePreset[] = [
  {
    key: 'master',
    name: 'Мастер',
    description: 'Своё расписание (только просмотр)',
    permissions: ['appointments.view', 'appointments.view_own'],
  },
  {
    key: 'senior_master',
    name: 'Старший мастер',
    description: 'Записи всех исполнителей',
    permissions: ['appointments.view', 'appointments.view_all', 'appointments.manage'],
  },
  {
    key: 'reception',
    name: 'Администратор салона',
    description: 'Запись клиентов, заказы, аналитика',
    permissions: [
      'appointments.view', 'appointments.view_all', 'appointments.manage',
      'orders.view', 'orders.create', 'menu.view', 'analytics.view', 'team.view',
    ],
  },
]

export const getRolePresets = ({ isServices, isRetail }: RolePresetOptions): RolePreset[] => {
  if (isServices) return SERVICES_PRESETS
  if (isRetail) return RETAIL_PRESETS

  return []
}
