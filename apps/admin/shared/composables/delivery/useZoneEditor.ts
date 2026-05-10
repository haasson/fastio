import { ref, computed, type Ref } from 'vue'
import type { DeliveryZone, Branch } from '@fastio/shared'

export type ZoneForm = {
  branchId: string
  name: string
  color: string
  deliveryFee: number | null
  minOrder: number | null
  freeDeliveryFrom: number | null
  coordinates: [number, number][]
}

export const useZoneEditor = (
  zones: Ref<DeliveryZone[]>,
  branches: Ref<Branch[]>,
) => {
  const selectedZoneId = ref<string | undefined>(undefined)
  const selectedBranchId = ref<string | undefined>(undefined)
  const isNewZone = ref(false)
  const drawing = ref(false)
  const drawingBranchId = ref<string | undefined>(undefined)
  const zoneForm = ref<ZoneForm | null>(null)

  const hasMultipleBranches = computed(() => branches.value.length > 1)
  const panelVisible = computed(() => zoneForm.value !== null && (!!selectedZoneId.value || isNewZone.value))

  const selectZone = (zone: DeliveryZone) => {
    selectedZoneId.value = zone.id
    selectedBranchId.value = zone.branchId
    isNewZone.value = false
    zoneForm.value = {
      branchId: zone.branchId,
      name: zone.name,
      color: zone.color,
      deliveryFee: zone.deliveryFee,
      minOrder: zone.minOrder,
      freeDeliveryFrom: zone.freeDeliveryFrom,
      coordinates: zone.coordinates,
    }
  }

  const onZoneClick = (zoneId: string) => {
    if (drawing.value) return
    const zone = zones.value.find((z) => z.id === zoneId)

    if (zone) selectZone(zone)
  }

  const startDraw = () => {
    if (hasMultipleBranches.value) {
      const branchId = selectedBranchId.value ?? branches.value[0]?.id

      if (!branchId) return
      drawingBranchId.value = branchId
      selectedBranchId.value = branchId
    } else {
      drawingBranchId.value = branches.value[0]?.id
    }

    drawing.value = true
    selectedZoneId.value = undefined
    isNewZone.value = false
    zoneForm.value = null
  }

  const onPolygonDrawn = (coordinates: [number, number][]) => {
    const branchId = drawingBranchId.value ?? branches.value[0]?.id

    drawing.value = false
    isNewZone.value = true
    selectedZoneId.value = undefined
    zoneForm.value = {
      branchId: branchId ?? '',
      name: '',
      color: '#FF5500',
      deliveryFee: 0,
      minOrder: 0,
      freeDeliveryFrom: 0,
      coordinates,
    }
  }

  const closePanel = () => {
    selectedZoneId.value = undefined
    isNewZone.value = false
    zoneForm.value = null
  }

  return {
    selectedZoneId,
    selectedBranchId,
    isNewZone,
    drawing,
    drawingBranchId,
    zoneForm,
    panelVisible,
    selectZone,
    onZoneClick,
    startDraw,
    onPolygonDrawn,
    closePanel,
  }
}
