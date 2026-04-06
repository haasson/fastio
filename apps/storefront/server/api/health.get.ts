import { getServerSupabase } from '../utils/supabase'

export default defineEventHandler(async () => {
  const supabase = getServerSupabase()

  const start = Date.now()
  const { error } = await supabase.from('tenants').select('id').limit(1)
  const dbLatencyMs = Date.now() - start

  return {
    status: error ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    db: {
      connected: !error,
      latencyMs: dbLatencyMs,
    },
  }
})
