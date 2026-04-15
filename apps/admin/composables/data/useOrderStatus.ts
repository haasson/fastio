import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Order } from '@fastio/shared'
import { getAllowedStatuses, getKitchenAutoStatuses } from '@fastio/shared'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useTenantStore } from '~/stores/tenant'
import { useStatusColor } from '~/composables/ui/useStatusColor'
import { useKitchenStatusBlock } from '~/composables/kitchen/useKitchenStatusBlock'
import { useConfirm } from '@fastio/kit'

type StatusForm = { status: string }

export const useOrderStatus = (
  order: Ref<Order | null>,
  isEdit: Ref<boolean>,
  form: StatusForm,
) => {
  const { statuses } = storeToRefs(useOrderStatusesStore())
  const tenantStore = useTenantStore()
  const { getStatusColor } = useStatusColor()
  const { checkKitchenBlock } = useKitchenStatusBlock()
  const { confirm } = useConfirm()

  const currentStatus = computed(() => statuses.value.find((s) => s.id === form.status) ?? null)
  const statusGroup = computed(() => currentStatus.value?.groupType ?? 'new')

  const can = computed(() => {
    if (!isEdit.value) return {}
    const g = statusGroup.value

    return {
      editCustomer: g === 'new' || g === 'in_progress',
      editDeliveryType: g === 'new',
      editAddress: g === 'new',
      editItems: g === 'new',
      editDeliveryFee: g === 'new' || g === 'in_progress',
      editPayment: g === 'new' || g === 'in_progress',
      editBranch: g === 'new',
      editScheduling: g === 'new',
    }
  })

  const statusMenuItems = computed(() => {
    const kitchenAuto = getKitchenAutoStatuses(tenantStore.tenant?.kitchenConfig)

    return getAllowedStatuses(statusGroup.value, statuses.value)
      .filter((s) => s.id !== form.status && !kitchenAuto.includes(s.id))
      .map((s) => ({ name: s.id, label: s.name, color: getStatusColor(s.id) }))
  })

  const onStatusSelect = async (newStatusId: string) => {
    if (!order.value) {
      form.status = newStatusId

      return
    }

    const newStatus = statuses.value.find((s) => s.id === newStatusId)
    const { blocked } = await checkKitchenBlock(order.value, newStatus?.groupType)

    if (blocked) return

    if (order.value.visitedStatuses.includes(newStatusId)) {
      const confirmed = await confirm({
        title: 'Возврат в предыдущий статус',
        message: `Заказ уже был в статусе «${newStatus?.name ?? newStatusId}». Вы уверены, что хотите вернуть его обратно?`,
        confirmText: 'Да, вернуть',
        cancelText: 'Отмена',
        confirmType: 'warning',
      })

      if (confirmed !== true) return
    }

    form.status = newStatusId
  }

  return { currentStatus, statusMenuItems, can, onStatusSelect }
}
