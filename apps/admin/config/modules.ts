import type { IconName } from '@fastio/icons'
import type { TenantModules } from '@fastio/shared'

export type ModuleKey = keyof TenantModules
export type PlanKey = 'start' | 'business' | 'pro'

export type ModuleConfig = {
  key: ModuleKey
  name: string
  description: string
  icon: IconName
  requiredPlan: PlanKey
}

export const PLAN_ORDER: Record<PlanKey, number> = {
  start: 0,
  business: 1,
  pro: 2,
}

export const PLAN_LABELS: Record<PlanKey, string> = {
  start: 'Старт',
  business: 'Бизнес',
  pro: 'Про',
}

export const MODULE_CONFIGS: ModuleConfig[] = [
  { key: 'delivery', name: 'Доставка', description: 'Принимать заказы с доставкой на адрес', icon: 'bike', requiredPlan: 'business' },
  { key: 'pickup', name: 'Самовывоз', description: 'Принимать заказы на самовывоз из ресторана', icon: 'cart', requiredPlan: 'business' },
  { key: 'modifiers', name: 'Модификаторы', description: 'Дополнительные опции к блюдам (температура, прожарка и т.д.)', icon: 'list', requiredPlan: 'business' },
  { key: 'addons', name: 'Добавки', description: 'Дополнительные товары к заказу (соусы, напитки и т.д.)', icon: 'plusRound', requiredPlan: 'business' },
  { key: 'promotions', name: 'Акции и промокоды', description: 'Скидки, промокоды и специальные предложения', icon: 'promotions', requiredPlan: 'business' },
  { key: 'combos', name: 'Комбо', description: 'Комбо-наборы из нескольких блюд по специальной цене', icon: 'dishes', requiredPlan: 'business' },
  { key: 'kitchen', name: 'Кухня', description: 'Экран для повара: заказы в реальном времени без лишнего интерфейса', icon: 'chefHat', requiredPlan: 'business' },
  { key: 'branches', name: 'Филиалы', description: 'Несколько точек приготовления и доставки с отдельными зонами и настройками', icon: 'mapPin', requiredPlan: 'pro' },
  { key: 'customRoles', name: 'Кастомные роли', description: 'Создавайте собственные роли сотрудников (Повар, Курьер, Кассир) с гибкими правами', icon: 'users', requiredPlan: 'pro' },
  { key: 'dineIn', name: 'Заказ со стола', description: 'QR-код на столе — клиент сканирует и делает заказ с телефона прямо в заведении', icon: 'tableIcon', requiredPlan: 'pro' },
]
