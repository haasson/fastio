export type Addon = {
  id: string
  tenantId: string
  name: string
  weight: number | null
  price: number
  active: boolean
  order: number
}

export type AddonPreset = {
  id: string
  tenantId: string
  name: string
  addonIds: string[]
  active: boolean
}
