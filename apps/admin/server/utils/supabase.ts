import { createClient } from '@supabase/supabase-js'

export function getServerSupabase() {
  const config = useRuntimeConfig()

  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
  )
}
