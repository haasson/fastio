// Public barrel of the menu-catalog module.
// Каталог блюд (retail): меню, категории, модалка блюда + customization (модификаторы/аддоны).

export { useMenuStore, type ClientAddon } from './stores/menu'
export {
  useDishCustomization,
  type ComboItemInfo,
  type ModalItem,
} from './composables/useDishCustomization'
