import type { DishTag } from '@fastio/shared'

// TODO: эти теги есть и в карточке блюда, и в модалке. Дублирование
export const tagOptions: Record<DishTag, string> = {
  spicy: 'Острое',
  vegetarian: 'Вегетарианское',
  vegan: 'Веганское',
  new: 'Новинка',
  popular: 'Популярное',
  hit: 'Хит продаж',
}
