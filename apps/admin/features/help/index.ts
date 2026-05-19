// Public barrel of the help module.

// Composables
export * from './composables/useTour'

// Tours registry
export { TOURS, TOUR_CATEGORIES } from './tours'
export type { Tour, TourCategory } from './tours'

// tours/ — индивидуальные туры (импорт через ~/features/help/tours/<X>).
