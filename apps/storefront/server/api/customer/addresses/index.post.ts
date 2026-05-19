import { mapCustomerAddress } from '../../../utils/supabase'
import { getAuthenticatedContext } from '../../../utils/customerAuth'
import { validateAddressTextFields } from './_validate'
import { reportError } from '~/shared/utils/reportError'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const body = await readBody(event)

  if (!body.address) {
    throw createError({ statusCode: 400, message: 'Адрес обязателен' })
  }

  validateAddressTextFields(body)

  const coords = body.coordinates
  if (
    !coords ||
    typeof coords.lat !== 'number' || typeof coords.lng !== 'number' ||
    !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) ||
    coords.lat < -90 || coords.lat > 90 ||
    coords.lng < -180 || coords.lng > 180
  ) {
    throw createError({ statusCode: 400, message: 'Некорректные координаты' })
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({
      customer_id: customerId,
      label: body.label ?? '',
      address: body.address,
      coordinates: `(${coords.lng},${coords.lat})`,
      entrance: body.entrance ?? null,
      floor: body.floor ?? null,
      apartment: body.apartment ?? null,
      intercom: body.intercom ?? null,
      comment: body.comment ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    reportError(error ?? new Error('customer_addresses insert returned no row'))
    throw createError({ statusCode: 500, message: 'Не удалось сохранить адрес' })
  }

  return mapCustomerAddress(data)
})
