import { ref, computed, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { DeliveryZone } from '@fastio/shared'
import { findDeliveryZone } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDeliveryZoneStore } from '~/stores/retail/deliveryZone'

export type DeliveryInfo = {
  outsideZones: boolean
  effectiveFee: number
  minOrderAmount: number
  belowMinOrder: boolean
  freeDeliveryFrom: number
  amountUntilFree: number
  branchMismatch: boolean
  branchAutoSwitched: boolean
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
  canEditBranch: Ref<boolean>
}

export const useOrderDelivery = ({ form, subtotal, selectedBranchId, canEditBranch }: OrderDeliveryOptions) => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const { zones } = storeToRefs(useDeliveryZoneStore())

  const activeBranchIds = computed(() => new Set(branchStore.branches.map((b) => b.id)))

  const activeZones = computed(() => {
    if (tenantStore.tenant.deliveryMode === 'fixed') return []

    return zones.value.filter((z) => z.isActive && activeBranchIds.value.has(z.branchId))
  })

  const currentZone = ref<DeliveryZone | null>(null)
  const addressOutsideZones = ref(false)
  const addressVerifiedForDelivery = ref(false)
  const branchSwitchedByZone = ref(false)
  const deliveryCoords = ref<{ lat: number; lon: number } | null>(null)

  const onZoneDetected = (zone: DeliveryZone | null, outsideZones: boolean, coords: [number, number] | null) => {
    currentZone.value = zone
    addressOutsideZones.value = outsideZones
    addressVerifiedForDelivery.value = true
    branchSwitchedByZone.value = false
    deliveryCoords.value = coords ? { lat: coords[1], lon: coords[0] } : null

    if (zone && canEditBranch.value && zone.branchId !== selectedBranchId.value) {
      selectedBranchId.value = zone.branchId
      branchSwitchedByZone.value = true
    }
  }

  const initFromOrder = (lat: number | null, lon: number | null) => {
    if (lat === null || lon === null) return

    deliveryCoords.value = { lat, lon }

    if (activeZones.value.length === 0) {
      addressVerifiedForDelivery.value = true

      return
    }

    const zone = findDeliveryZone([lon, lat], activeZones.value)

    currentZone.value = zone
    addressOutsideZones.value = !zone
    addressVerifiedForDelivery.value = true
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
    const isFixed = tenant.deliveryMode === 'fixed'
    const zone = currentZone.value
    const outside = addressOutsideZones.value

    const minOrderAmount = isFixed ? (tenant.deliveryMinOrder ?? 0) : (zone?.minOrder ?? 0)
    const freeDeliveryFrom = isFixed ? (tenant.freeDeliveryFrom ?? 0) : (zone?.freeDeliveryFrom ?? 0)
    const effectiveFee = effectiveDeliveryFee.value ?? 0
    const belowMinOrder = minOrderAmount > 0 && subtotal.value > 0 && subtotal.value < minOrderAmount
    const amountUntilFree = freeDeliveryFrom > 0 && effectiveFee > 0 ? Math.max(0, freeDeliveryFrom - subtotal.value) : 0

    const branchAutoSwitched = !outside && zone !== null && branchSwitchedByZone.value && zone.branchId === selectedBranchId.value
    const branchMismatch = !outside && zone !== null && zone.branchId !== selectedBranchId.value
    const zoneBranchName = (branchMismatch || branchAutoSwitched) ? (branchStore.branches.find((b) => b.id === zone!.branchId)?.name ?? '') : ''
    const currentBranchName = branchMismatch ? (branchStore.branches.find((b) => b.id === selectedBranchId.value)?.name ?? '') : ''

    return {
      outsideZones: outside, effectiveFee, minOrderAmount, belowMinOrder, freeDeliveryFrom, amountUntilFree,
      branchMismatch, branchAutoSwitched, zoneBranchName, currentBranchName,
    }
  })

  return { activeZones, deliveryInfo, effectiveDeliveryFee, deliveryCoords, onZoneDetected, initFromOrder }
}
