import type { TourStep } from '~/composables/useTour'
import type { ModuleKey } from '~/config/modules'
import type { PermissionKey } from '@fastio/shared'
import { getOnboardingSteps } from '~/tours/onboardingTour'
import { getCategoryTourSteps } from '~/tours/categoryTour'
import { getDishTourSteps } from '~/tours/dishTour'
import { getModifierTourSteps } from '~/tours/modifierTour'
import { getAddonTourSteps } from '~/tours/addonTour'
import { getTagsTourSteps } from '~/tours/tagsTour'
import { getOrdersTourSteps } from '~/tours/ordersTour'
import { getStatusesTourSteps } from '~/tours/statusesTour'
import { getOrderNumberTourSteps } from '~/tours/orderNumberTour'
import { getDeliveryTourSteps } from '~/tours/deliveryTour'
import { getOrderSettingsTourSteps } from '~/tours/orderSettingsTour'
import { getKitchenQueueTourSteps } from '~/tours/kitchenQueueTour'
import { getKitchenAssemblyTourSteps } from '~/tours/kitchenAssemblyTour'
import { getKitchenOverviewTourSteps } from '~/tours/kitchenOverviewTour'
import { getKitchenSettingsTourSteps } from '~/tours/kitchenSettingsTour'

export type TourCategory = {
  id: string
  title: string
}

export const TOUR_CATEGORIES: TourCategory[] = [
  { id: 'basics', title: 'Начало работы' },
  { id: 'menu', title: 'Меню' },
  { id: 'orders', title: 'Заказы' },
  { id: 'kitchen', title: 'Кухня' },
]

export type Tour = {
  id: string
  title: string
  description: string
  category: string
  moduleRequired?: ModuleKey
  permissionRequired?: PermissionKey
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
    moduleRequired: 'modifiers',
    title: 'Как работают модификаторы',
    description: 'Размер, бортик, прожарка — как создавать группы вариантов для блюд.',
    getSteps: getModifierTourSteps,
  },
  {
    id: 'addons',
    category: 'menu',
    moduleRequired: 'addons',
    title: 'Как работают добавки',
    description: 'Соусы, топпинги, дополнительные ингредиенты — и пресеты для быстрого назначения.',
    getSteps: getAddonTourSteps,
  },
  {
    id: 'tags',
    category: 'menu',
    title: 'Как работают теги',
    description: 'Острое, вегетарианское, новинка — как создавать и назначать метки на блюда.',
    getSteps: getTagsTourSteps,
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
    moduleRequired: 'delivery',
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
  {
    id: 'kitchen-queue',
    category: 'kitchen',
    moduleRequired: 'kitchen',
    permissionRequired: 'kitchen.view',
    title: 'Кухонная очередь',
    description: 'Рабочее место повара: берёте блюдо из очереди, готовите, отмечаете готовым.',
    getSteps: getKitchenQueueTourSteps,
  },
  {
    id: 'kitchen-assembly',
    category: 'kitchen',
    moduleRequired: 'kitchen',
    permissionRequired: 'kitchen.view',
    title: 'Сборка заказов',
    description: 'Как собирать заказы на выдаче и переводить их в финальный статус.',
    getSteps: getKitchenAssemblyTourSteps,
  },
  {
    id: 'kitchen-overview',
    category: 'kitchen',
    moduleRequired: 'kitchen',
    permissionRequired: 'kitchen.overview',
    title: 'Обзор кухни',
    description: 'Вид для менеджера: все блюда в работе, срочные и критичные.',
    getSteps: getKitchenOverviewTourSteps,
  },
  {
    id: 'kitchen-settings',
    category: 'kitchen',
    moduleRequired: 'kitchen',
    permissionRequired: 'settings.edit',
    title: 'Настройки кухни',
    description: 'Привязка очереди к статусам заказов и настройка порога срочности.',
    getSteps: getKitchenSettingsTourSteps,
  },
]
