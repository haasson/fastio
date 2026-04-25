import type { Order, OrderStatusGroup } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useConfirm } from '@fastio/kit'

type KitchenBlockResult = {
  blocked: boolean
}

export function useKitchenStatusBlock() {
  const tenantStore = useTenantStore()
  const { confirm } = useConfirm()

  const checkKitchenBlock = async (
    order: Order,
    targetGroupType: OrderStatusGroup | undefined,
  ): Promise<KitchenBlockResult> => {
    const kitchenEnabled = tenantStore.tenant.modules?.kitchen === true
      && !!tenantStore.tenant.kitchenConfig?.sourceStatusId

    if (!kitchenEnabled) return { blocked: false }
    if (targetGroupType === 'cancelled') return { blocked: false }
    if (order.deliveryType === 'dine_in') return { blocked: false }

    const isOnKitchen = !!order.kitchenQueuedAt && !order.kitchenCompletedAt

    if (!isOnKitchen) return { blocked: false }

    await confirm({
      title: 'Заказ на кухне',
      message: 'Заказ сейчас готовится или собирается. Ручное изменение статуса недоступно, пока сборщик не завершит сборку. Если заказ нужно отменить — используйте статус «Отменён».',
      confirmText: false,
      cancelText: 'Понятно',
    })

    return { blocked: true }
  }

  return { checkKitchenBlock }
}
