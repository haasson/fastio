import { defineEventHandler, createError } from 'h3'
import { getAdminClient } from '../utils/adminClient'

export default defineEventHandler(async () => {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
