import type { Plan, MenuStyle } from '@fastio/shared'
import { extractPlanTier, getPlanTierOrder } from '@fastio/shared'

const MODULE_LABELS: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  modifiers: 'Модификаторы',
  addons: 'Добавки',
  promotions: 'Акции и промокоды',
  combos: 'Комбо-наборы',
  kitchen: 'Экран кухни (KDS)',
  dineIn: 'QR-столы и зал',
  reservations: 'Бронирование столиков',
  services: 'Онлайн-запись',
  branches: 'Филиалы',
  customRoles: 'Кастомные роли',
  customers: 'База клиентов',
  team: 'Управление командой',
  dashboard: 'Дашборд и статистика',
}

const SHOWCASE_BASE_FEATURES = {
  food: ['Конструктор сайта', 'Каталог блюд', 'Кастомный домен', 'Тема и дизайн'],
  catalog: ['Конструктор сайта', 'Каталог товаров', 'Кастомный домен', 'Тема и дизайн'],
  services: ['Конструктор сайта', 'Каталог услуг', 'Кастомный домен', 'Тема и дизайн'],
} as const

export const getPlanFeatureLabels = (plan: Plan, menuStyle: MenuStyle = 'food'): string[] => {
  if (extractPlanTier(plan.key) === 'showcase') {
    if (plan.businessType === 'services') return [...SHOWCASE_BASE_FEATURES.services]

    return [...SHOWCASE_BASE_FEATURES[menuStyle]]
  }

  const labels: string[] = []
  const f = plan.features
  const mods = f.modules ?? {}

  for (const [key, val] of Object.entries(mods)) {
    if (val && MODULE_LABELS[key]) labels.push(MODULE_LABELS[key])
  }
  if (f.site?.telegramNotifications) labels.push('Уведомления в Telegram')
  if (f.menu?.virtualCategories) labels.push('Виртуальные категории')
  if (f.menu?.ingredients) labels.push('Состав блюд')
  if (f.resources?.max !== undefined) {
    labels.push(f.resources.max === 0 ? 'Без лимита ресурсов' : `До ${f.resources.max} активных ресурсов`)
  }

  return labels
}

/** Имя соседнего тарифа на ступень ниже (для строки «Всё из тарифа X»). */
export const getPrevPlanName = (plan: Plan, allPlans: readonly Plan[]): string | null => {
  const order = getPlanTierOrder(plan.key)

  if (order === 0) return null
  const prev = allPlans.find(
    (p) => p.businessType === plan.businessType && getPlanTierOrder(p.key) === order - 1,
  )

  return prev?.name ?? null
}

/** Текст подтверждения смены тарифа: на триале списания нет, иначе — обычное списание с баланса. */
export const getChangePlanConfirmText = (price: number, isOnTrial: boolean): string => {
  if (isOnTrial) return 'Тариф изменится сразу. Списаний не будет — вы на пробном периоде.'

  return `Сейчас с баланса спишется ${price.toLocaleString('ru')} ₽, и начнётся новый оплачиваемый период на 30 дней. Неиспользованные деньги за текущий тариф не возвращаются.`
}
