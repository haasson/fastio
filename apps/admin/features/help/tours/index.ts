import type { TourStep } from '~/composables/useTour'
import type { GateRegistry } from '~/composables/plan/useGate.types'
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
  /**
   * Условие видимости тура. Принимает реестр гейтов и возвращает true,
   * если тур актуален текущему пользователю/тенанту. Без поля — виден всегда.
   * Работает в обе стороны: и фильтр по модулям/тарифу, и по правам роли.
   */
  isVisible?: (g: GateRegistry) => boolean
  getSteps: () => TourStep[]
}

const ordersAvailable = (g: GateRegistry) => g.delivery.value.enabled || g.pickup.value.enabled

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
    isVisible: (g) => g.modifiers.value.enabled,
    title: 'Как работают модификаторы',
    description: 'Размер, бортик, прожарка — как создавать группы вариантов для блюд.',
    getSteps: getModifierTourSteps,
  },
  {
    id: 'addons',
    category: 'menu',
    isVisible: (g) => g.addons.value.enabled,
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
    isVisible: ordersAvailable,
    title: 'Как работать с заказами',
    description: 'Статусы, карточки заказов, быстрая смена статуса и создание заказа вручную.',
    getSteps: getOrdersTourSteps,
  },
  {
    id: 'order-statuses',
    category: 'orders',
    isVisible: ordersAvailable,
    title: 'Настройка статусов',
    description: 'Создавайте свои статусы, задавайте им группы и быстрые действия.',
    getSteps: getStatusesTourSteps,
  },
  {
    id: 'order-number',
    category: 'orders',
    isVisible: ordersAvailable,
    title: 'Нумерация заказов',
    description: 'Формат номера заказа: счётчик, дата, префикс, сброс.',
    getSteps: getOrderNumberTourSteps,
  },
  {
    id: 'delivery',
    category: 'orders',
    isVisible: (g) => g.delivery.value.enabled,
    title: 'Зоны доставки',
    description: 'Фиксированная стоимость или зоны на карте с индивидуальными условиями.',
    getSteps: getDeliveryTourSteps,
  },
  {
    id: 'order-settings',
    category: 'orders',
    isVisible: ordersAvailable,
    title: 'Предзаказ',
    description: 'Разрешите клиентам выбирать время заказа — настройте слоты и буферы.',
    getSteps: getOrderSettingsTourSteps,
  },
  {
    id: 'kitchen-queue',
    category: 'kitchen',
    isVisible: (g) => g.viewKitchenQueue.value.enabled,
    title: 'Кухонная очередь',
    description: 'Рабочее место повара: берёте блюдо из очереди, готовите, отмечаете готовым.',
    getSteps: getKitchenQueueTourSteps,
  },
  {
    id: 'kitchen-assembly',
    category: 'kitchen',
    isVisible: (g) => g.viewKitchenQueue.value.enabled,
    title: 'Сборка заказов',
    description: 'Как собирать заказы на выдаче и переводить их в финальный статус.',
    getSteps: getKitchenAssemblyTourSteps,
  },
  {
    id: 'kitchen-overview',
    category: 'kitchen',
    isVisible: (g) => g.viewKitchenOverview.value.enabled,
    title: 'Обзор кухни',
    description: 'Вид для менеджера: все блюда в работе, срочные и критичные.',
    getSteps: getKitchenOverviewTourSteps,
  },
  {
    id: 'kitchen-settings',
    category: 'kitchen',
    isVisible: (g) => g.kitchen.value.enabled && g.editSettings.value.enabled,
    title: 'Настройки кухни',
    description: 'Привязка очереди к статусам заказов и настройка порога срочности.',
    getSteps: getKitchenSettingsTourSteps,
  },
]
