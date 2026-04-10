import { ref, computed, watch, type Ref } from 'vue'
import type { DeliveryZone } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAllDeliveryZones } from '~/composables/delivery/useAllDeliveryZones'

export type DeliveryInfo = {
  outsideZones: boolean
  effectiveFee: number
  minOrderAmount: number
  belowMinOrder: boolean
  freeDeliveryFrom: number
  amountUntilFree: number
  branchMismatch: boolean
  zoneBranchName: string
  currentBranchName: string
}

type OrderDeliveryForm = {
  deliveryType: string
}

type OrderDeliveryOptions = {
  form: OrderDeliveryForm
  subtotal: Ref<number>
  selectedBranchId: Ref<string | null>
  isEdit: Ref<boolean>
}

export const useOrderDelivery = ({ form, subtotal, selectedBranchId, isEdit }: OrderDeliveryOptions) => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const { zones } = useAllDeliveryZones()

  const activeBranchIds = computed(() => new Set(branchStore.branches.map((b) => b.id)))

  const activeZones = computed(() => {
    if (tenantStore.tenant?.deliveryMode === 'fixed') return []

    return zones.value.filter((z) => z.isActive && activeBranchIds.value.has(z.branchId))
  })

  const currentZone = ref<DeliveryZone | null>(null)
  const addressOutsideZones = ref(false)
  const addressVerifiedForDelivery = ref(false)

  const onZoneDetected = (zone: DeliveryZone | null, outsideZones: boolean) => {
    currentZone.value = zone
    addressOutsideZones.value = outsideZones
    addressVerifiedForDelivery.value = true

    if (zone) {
      if (!isEdit.value) {
        selectedBranchId.value = zone.branchId
      }
    }
  }

  watch(() => form.deliveryType, () => {
    currentZone.value = null
    addressOutsideZones.value = false
    addressVerifiedForDelivery.value = false
  })

  const effectiveDeliveryFee = computed(() => {
    if (form.deliveryType !== 'delivery') return null
    if (!addressVerifiedForDelivery.value) return null

    const tenant = tenantStore.tenant

    if (!tenant) return null

    if (tenant.deliveryMode === 'fixed') {
      const freeFrom = tenant.freeDeliveryFrom ?? 0

      if (freeFrom > 0 && subtotal.value >= freeFrom) return 0

      return tenant.deliveryFee ?? 0
    }

    if (addressOutsideZones.value || !currentZone.value) return null
    const zone = currentZone.value

    if (zone.freeDeliveryFrom > 0 && subtotal.value >= zone.freeDeliveryFrom) return 0

    return zone.deliveryFee
  })

  const deliveryInfo = computed<DeliveryInfo | null>(() => {
    if (form.deliveryType !== 'delivery') return null
    if (!addressVerifiedForDelivery.value) return null

    const tenant = tenantStore.tenant

    if (!tenant) return null

    const isFixed = tenant.deliveryMode === 'fixed'
    const zone = currentZone.value
    const outside = addressOutsideZones.value

    const minOrderAmount = isFixed ? (tenant.deliveryMinOrder ?? 0) : (zone?.minOrder ?? 0)
    const freeDeliveryFrom = isFixed ? (tenant.freeDeliveryFrom ?? 0) : (zone?.freeDeliveryFrom ?? 0)
    const effectiveFee = effectiveDeliveryFee.value ?? 0
    const belowMinOrder = minOrderAmount > 0 && subtotal.value > 0 && subtotal.value < minOrderAmount
    const amountUntilFree = freeDeliveryFrom > 0 && effectiveFee > 0 ? Math.max(0, freeDeliveryFrom - subtotal.value) : 0

    const branchMismatch = !outside && zone !== null && isEdit.value && zone.branchId !== selectedBranchId.value
    const zoneBranchName = branchMismatch ? (branchStore.branches.find((b) => b.id === zone!.branchId)?.name ?? '') : ''
    const currentBranchName = branchMismatch ? (branchStore.branches.find((b) => b.id === selectedBranchId.value)?.name ?? '') : ''

    return {
      outsideZones: outside, effectiveFee, minOrderAmount, belowMinOrder, freeDeliveryFrom, amountUntilFree,
      branchMismatch, zoneBranchName, currentBranchName,
    }
  })

  return { activeZones, deliveryInfo, effectiveDeliveryFee, onZoneDetected }
}
