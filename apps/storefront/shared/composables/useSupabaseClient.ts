import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function useSupabaseClient(): SupabaseClient {
  if (client) return client

  const config = useRuntimeConfig()
  client = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: 'fs-auth',
      autoRefreshToken: true,
    },
  })

  return client
}
