import { defineEventHandler, createError } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'
import type { LandingPlanRow } from '~/types/plan'

export default defineEventHandler(async (): Promise<LandingPlanRow[]> => {
  const config = useRuntimeConfig()
  const { supabaseUrl, supabaseAnonKey } = config.public

  console.log('[plans.get] url:', supabaseUrl, 'key:', supabaseAnonKey?.slice(0, 20))

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[plans.get] NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY не заданы — секция тарифов будет пустой')
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from('plans')
    .select('key, business_type, name, description, price, sort_order, badge, is_featured, features')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('[plans.get] supabase error:', error.message)
    throw createError({ statusCode: 500, message: error.message })
  }

  return (data ?? []) as LandingPlanRow[]
})
