// Service-role Supabase клиент для серверных эндпоинтов админки.
// Singleton по namespace nitro instance: один клиент переиспользуется между
// запросами, чтобы не плодить http-агенты на каждый вызов.
//
// PREPROD-120: добавлен `resetServerSupabase()` — вызывать на 401 от Supabase
// (например, после ротации service-role-key), чтобы пересоздать клиент с
// новым ключом без полного рестарта процесса.
//
// JWK-flow (ES256 JWT) не используется: self-hosted Supabase в Coolify работает
// со static service-role-key (`supabaseServiceRoleKey`). Если в будущем
// переедем на JWK — синкаем с `apps/landing/server/utils/adminClient.ts`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

let cachedClient: SupabaseClient | null = null

export function getServerSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient

  const config = useRuntimeConfig()

  cachedClient = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedClient
}

/**
 * Сбрасывает закешированный клиент. Вызывать на 401 от Supabase в service-role
 * операциях (после ротации ключа через env update) — следующий `getServerSupabase()`
 * пересоздаст клиент с актуальным `config.supabaseServiceRoleKey`.
 */
export function resetServerSupabase(): void {
  cachedClient = null
}
