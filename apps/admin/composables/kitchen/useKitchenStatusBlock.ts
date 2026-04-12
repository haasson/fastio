import type { OrderStatus } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useConfirm } from '@fastio/kit'

type KitchenBlockResult = {
  blocked: boolean
}

export function useKitchenStatusBlock() {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const { confirm } = useConfirm()

  const checkKitchenBlock = async (
    orderId: string,
    oldStatusId: string | null,
    newStatus: OrderStatus | undefined,
  ): Promise<KitchenBlockResult> => {
    const kitchenConfig = tenantStore.tenant?.kitchenConfig
    const kitchenEnabled = tenantStore.tenant?.modules?.kitchen === true && !!kitchenConfig?.sourceStatusId

    if (!kitchenEnabled || newStatus?.groupType === 'cancelled') {
      return { blocked: false }
    }

    const kitchenControlledStatuses = [
      kitchenConfig.cookingStatusId,
      kitchenConfig.completedStatusMap?.delivery,
      kitchenConfig.completedStatusMap?.pickup,
      kitchenConfig.completedStatusMap?.dine_in,
    ].filter(Boolean)

    const isKitchenControlled = oldStatusId !== null && kitchenControlledStatuses.includes(oldStatusId)
    const activeCount = isKitchenControlled ? 0 : await api.kitchenQueue.countActiveForOrder(orderId)

    if (!isKitchenControlled && activeCount === 0) {
      return { blocked: false }
    }

    const targetGroup = newStatus?.groupType ?? 'in_progress'

    const kitchenBlockMessages: Record<string, { title: string; message: string }> = {
      new: {
        title: 'Заказ на кухне',
        message: isKitchenControlled
          ? 'Этот статус установлен кухней автоматически. Вернуть назад нельзя — это нарушит процесс приготовления. Если заказ нужно отменить — используйте статус «Отменён».'
          : `Заказ уже передан на кухню — повар готовит блюда (${activeCount} шт). Вернуть назад нельзя, это нарушит процесс приготовления. Если заказ нужно отменить — используйте статус «Отменён».`,
      },
      in_progress: {
        title: 'Статус управляется кухней',
        message: isKitchenControlled
          ? 'Этот статус установлен кухней автоматически и обновляется по мере приготовления блюд. Ручное изменение запрещено. Если заказ нужно отменить — используйте статус «Отменён».'
          : `Сейчас готовятся ${activeCount} блюд. Статус заказа обновится автоматически: при взятии первого блюда и при завершении всех блюд. Если заказ нужно отменить — используйте статус «Отменён».`,
      },
      completed: {
        title: 'Статус управляется кухней',
        message: isKitchenControlled
          ? 'Этот статус установлен кухней автоматически после завершения всех блюд. Ручное изменение запрещено. Если заказ нужно отменить — используйте статус «Отменён».'
          : `На кухне ещё ${activeCount} блюд в работе. Статус автоматически сменится на завершённый, когда все блюда будут готовы.`,
      },
    }

    const msg = kitchenBlockMessages[targetGroup] ?? kitchenBlockMessages.in_progress

    await confirm({
      title: msg.title,
      message: msg.message,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return { blocked: true }
  }

  return { checkKitchenBlock }
}
