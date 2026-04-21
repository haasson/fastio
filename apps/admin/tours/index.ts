import type { TourStep } from '~/composables/useTour'
import { getOnboardingSteps } from '~/tours/onboardingTour'
import { getCategoryTourSteps } from '~/tours/categoryTour'
import { getDishTourSteps } from '~/tours/dishTour'
import { getModifierTourSteps } from '~/tours/modifierTour'
import { getAddonTourSteps } from '~/tours/addonTour'
import { getOrdersTourSteps } from '~/tours/ordersTour'
import { getStatusesTourSteps } from '~/tours/statusesTour'
import { getOrderNumberTourSteps } from '~/tours/orderNumberTour'
import { getDeliveryTourSteps } from '~/tours/deliveryTour'
import { getOrderSettingsTourSteps } from '~/tours/orderSettingsTour'

export type TourCategory = {
  id: string
  title: string
}

export const TOUR_CATEGORIES: TourCategory[] = [
  { id: 'basics', title: 'Начало работы' },
  { id: 'menu', title: 'Меню' },
  { id: 'orders', title: 'Заказы' },
]

export type Tour = {
  id: string
  title: string
  description: string
  category: string
  getSteps: () => TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: 'onboarding',
    category: 'basics',
    title: 'Обзор интерфейса',
    description: 'Быстрая экскурсия по всем разделам административной панели.',
    getSteps: getOnboardingSteps,
  },
  {
    id: 'create-category',
    category: 'menu',
    title: 'Как создать категорию',
    description: 'Категории — основа структуры меню. Узнайте как их создавать.',
    getSteps: getCategoryTourSteps,
  },
  {
    id: 'create-dish',
    category: 'menu',
    title: 'Как создать блюдо',
    description: 'Добавляйте блюда в меню за несколько шагов.',
    getSteps: getDishTourSteps,
  },
  {
    id: 'modifiers',
    category: 'menu',
    title: 'Как работают модификаторы',
    description: 'Размер, бортик, прожарка — как создавать группы вариантов для блюд.',
    getSteps: getModifierTourSteps,
  },
  {
    id: 'addons',
    category: 'menu',
    title: 'Как работают добавки',
    description: 'Соусы, топпинги, дополнительные ингредиенты — и пресеты для быстрого назначения.',
    getSteps: getAddonTourSteps,
  },
  {
    id: 'orders',
    category: 'orders',
    title: 'Как работать с заказами',
    description: 'Статусы, карточки заказов, быстрая смена статуса и создание заказа вручную.',
    getSteps: getOrdersTourSteps,
  },
  {
    id: 'order-statuses',
    category: 'orders',
    title: 'Настройка статусов',
    description: 'Создавайте свои статусы, задавайте им группы и быстрые действия.',
    getSteps: getStatusesTourSteps,
  },
  {
    id: 'order-number',
    category: 'orders',
    title: 'Нумерация заказов',
    description: 'Формат номера заказа: счётчик, дата, префикс, сброс.',
    getSteps: getOrderNumberTourSteps,
  },
  {
    id: 'delivery',
    category: 'orders',
    title: 'Зоны доставки',
    description: 'Фиксированная стоимость или зоны на карте с индивидуальными условиями.',
    getSteps: getDeliveryTourSteps,
  },
  {
    id: 'order-settings',
    category: 'orders',
    title: 'Предзаказ',
    description: 'Разрешите клиентам выбирать время заказа — настройте слоты и буферы.',
    getSteps: getOrderSettingsTourSteps,
  },
]
