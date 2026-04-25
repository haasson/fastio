export type Customer = {
  id: string
  tenantId: string
  authUserId: string | null
  telegramId: string | null
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: string
}

export type CustomerAddress = {
  id: string
  customerId: string
  label: string
  address: string
  coordinates: { lat: number; lng: number }
  entrance: string | null
  floor: string | null
  apartment: string | null
  intercom: string | null
  comment: string | null
  createdAt: string
}
