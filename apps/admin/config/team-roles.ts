import type { PermissionKey } from '@fastio/shared'
import { AUDIT_LOG_ENABLED } from '~/utils/featureFlags'

export type PermissionGroup = {
  label: string
  permissions: { key: PermissionKey; label: string }[]
}

export const permissionGroups: PermissionGroup[] = [
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
      { key: 'kitchen.overview', label: 'Обзор всей кухни (для менеджеров)' },
    ],
  },
  {
    label: 'Столы',
    permissions: [
      { key: 'tables.view', label: 'Просмотр столов и вызовов' },
      { key: 'tables.manage', label: 'Управление столами' },
    ],
  },
  {
    label: 'Бронирования',
    permissions: [
      { key: 'reservations.view', label: 'Просмотр бронирований' },
      { key: 'reservations.manage', label: 'Управление бронированиями' },
    ],
  },
  {
    label: 'Онлайн-запись',
    permissions: [
      { key: 'appointments.view', label: 'Просмотр записей' },
      { key: 'appointments.manage', label: 'Управление записями' },
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
      ...(AUDIT_LOG_ENABLED ? [{ key: 'audit_log.view' as PermissionKey, label: 'Просмотр журнала действий' }] : []),
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
