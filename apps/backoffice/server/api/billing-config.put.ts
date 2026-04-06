import { defineEventHandler, createError, readBody } from 'h3'
import { getAdminClient } from '../utils/adminClient'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const gracePeriodDays = Math.floor(Number(body.grace_period_days))
  const trialDays = Math.floor(Number(body.trial_days))

  if (!gracePeriodDays || gracePeriodDays < 1 || gracePeriodDays > 30) {
    throw createError({ statusCode: 400, message: 'grace_period_days must be between 1 and 30' })
  }

  if (!trialDays || trialDays < 1 || trialDays > 30) {
    throw createError({ statusCode: 400, message: 'trial_days must be between 1 and 30' })
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('billing_config')
    .update({ grace_period_days: gracePeriodDays, trial_days: trialDays })
    .eq('id', true)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
