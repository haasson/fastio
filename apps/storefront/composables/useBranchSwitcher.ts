import { useSelectedBranchStore } from '~/stores/selectedBranch'
import { useCartStore, isDishItem, type CartItem } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useConfirm } from '~/composables/useConfirm'
import { getMissingBranchDishNames } from '~/utils/branchCompat'

/**
 * Смена филиала в режиме per_branch:
 * 1. Если в корзине есть dish-позиции, недоступные в новом филиале — спросить.
 * 2. По «Да» — выкинуть несовместимые dish-позиции (services не трогаем, у них своя ось).
 * 3. Записать новый филиал.
 *
 * Возвращает true, если филиал сменён; false, если пользователь отменил.
 *
 * Живёт отдельно от модалки/шапки/любого UI — чтобы любой инициатор смены филиала
 * (BranchPickerModal, header switcher, deep-link) шёл через одну точку, и нельзя
 * было случайно поменять филиал и оставить корзину с фантомами.
 */
export function useBranchSwitcher() {
  const branchStore = useSelectedBranchStore()
  const cartStore = useCartStore()
  const menuStore = useMenuStore()
  const { confirm } = useConfirm()

  async function switchTo(id: string): Promise<boolean> {
    if (id === branchStore.id) return true

    const dishItems = cartStore.dishItems

    if (dishItems.length > 0) {
      const dishesById = new Map(menuStore.allDishes.map((d) => [d.id, d]))
      const missing = getMissingBranchDishNames(dishItems, dishesById, id, menuStore.branchesAll.length)

      if (missing.length > 0) {
        const ok = await confirm(
          `В этом филиале нет: ${missing.join(', ')}. Убрать эти позиции и продолжить?`,
          { confirmLabel: 'Убрать и сменить', danger: true },
        )

        if (!ok) return false

        const totalBranches = menuStore.branchesAll.length
        const filtered: CartItem[] = cartStore.items.filter((it) => {
          if (!isDishItem(it)) return true
          if (!it.dishId) return true
          const dish = dishesById.get(it.dishId)

          if (!dish) return true

          return (
            dish.branchIds.length === 0
            || dish.branchIds.length >= totalBranches
            || dish.branchIds.includes(id)
          )
        })

        cartStore.replaceAll(filtered)
      }
    }

    branchStore.set(id)

    return true
  }

  return { switchTo }
}
