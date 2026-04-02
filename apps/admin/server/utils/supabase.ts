import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

export function getServerSupabase() {
  const config = useRuntimeConfig()

  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
  )
}
