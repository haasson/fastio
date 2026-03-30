import type { TourStep } from '~/composables/useTour'
import { getOnboardingSteps } from '~/tours/onboardingTour'
import { getCategoryTourSteps } from '~/tours/categoryTour'
import { getDishTourSteps } from '~/tours/dishTour'
import { getModifierTourSteps } from '~/tours/modifierTour'
import { getAddonTourSteps } from '~/tours/addonTour'

export type TourCategory = {
  id: string
  title: string
}

export const TOUR_CATEGORIES: TourCategory[] = [
  { id: 'basics', title: 'Начало работы' },
  { id: 'menu', title: 'Меню' },
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
]
