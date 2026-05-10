import type { Order, OrderStatusGroup } from '@fastio/shared'
import { useGate } from '~/shared/plan/useGate'
import { useConfirm } from '@fastio/kit'

type KitchenBlockResult = {
  blocked: boolean
}

export function useKitchenStatusBlock() {
  const gate = useGate()
  const { confirm } = useConfirm()

  const checkKitchenBlock = async (
    order: Order,
    targetGroupType: OrderStatusGroup | undefined,
  ): Promise<KitchenBlockResult> => {
    const kitchenEnabled = gate.kitchenAutoStatus.value.enabled

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
