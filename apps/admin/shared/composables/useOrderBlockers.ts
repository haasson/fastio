import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { isLegalInfoComplete, extractPlanTier } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDeliveryZoneStore } from '~/features/orders'

export type OrderBlocker = {
  message: string
  link: string
  linkLabel: string
}

export const useOrderBlockers = () => {
  const { tenant } = storeToRefs(useTenantStore())
  const { zones } = storeToRefs(useDeliveryZoneStore())

  const blockers = computed((): OrderBlocker[] => {
    const t = tenant.value

    if (t.businessType === 'services') return []
    if (extractPlanTier(t.subscription?.plan ?? 'showcase') === 'showcase') return []

    const result: OrderBlocker[] = []

    if (!t.modules.delivery && !t.modules.pickup) {
      result.push({
        message: 'Не включён ни один способ получения заказа',
        link: '/settings/modules',
        linkLabel: 'Настроить',
      })
    } else if (t.modules.delivery && t.deliveryMode === 'zones' && zones.value.length === 0) {
      result.push({
        message: 'Нет активных зон доставки',
        link: '/orders/delivery',
        linkLabel: 'Добавить зоны',
      })
    }

    if (!isLegalInfoComplete(t.legalInfo)) {
      result.push({
        message: 'Не заполнены юридические данные',
        link: '/settings/legal',
        linkLabel: 'Заполнить',
      })
    }

    return result
  })

  return { blockers }
}
