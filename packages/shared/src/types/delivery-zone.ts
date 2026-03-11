export type DeliveryZone = {
  id: string
  tenantId: string
  branchId: string
  name: string
  color: string
  coordinates: [number, number][]  // [lng, lat] пары
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom: number
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type DeliveryZoneFormData = {
  branchId: string
  name: string
  color: string
  coordinates: [number, number][]
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom: number
  isActive: boolean
}

export type DeliveryZoneRow = {
  id: string
  tenant_id: string
  branch_id: string
  name: string
  color: string
  coordinates: [number, number][]
  delivery_fee: number
  min_order: number
  free_delivery_from: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const mapDeliveryZoneRow = (row: DeliveryZoneRow): DeliveryZone => ({
  id: row.id,
  tenantId: row.tenant_id,
  branchId: row.branch_id,
  name: row.name,
  color: row.color,
  coordinates: row.coordinates,
  deliveryFee: row.delivery_fee,
  minOrder: row.min_order,
  freeDeliveryFrom: row.free_delivery_from,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})
