import { createError } from 'h3'

export const ADDRESS_FIELD_LIMITS = {
  label: 100,
  address: 500,
  comment: 500,
  entrance: 50,
  floor: 50,
  apartment: 50,
  intercom: 50,
} as const

export type AddressTextField = keyof typeof ADDRESS_FIELD_LIMITS

const FIELD_LABELS: Record<AddressTextField, string> = {
  label: 'Название',
  address: 'Адрес',
  comment: 'Комментарий',
  entrance: 'Подъезд',
  floor: 'Этаж',
  apartment: 'Квартира',
  intercom: 'Домофон',
}

export function assertAddressFieldLength(field: AddressTextField, value: unknown): void {
  if (value === null || value === undefined) return
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: `Некорректное поле: ${FIELD_LABELS[field]}` })
  }
  const limit = ADDRESS_FIELD_LIMITS[field]
  if (value.length > limit) {
    throw createError({
      statusCode: 400,
      message: `${FIELD_LABELS[field]} слишком длинный (макс. ${limit} символов)`,
    })
  }
}

export function validateAddressTextFields(body: Record<string, unknown>): void {
  for (const field of Object.keys(ADDRESS_FIELD_LIMITS) as AddressTextField[]) {
    if (field in body) assertAddressFieldLength(field, body[field])
  }
}
