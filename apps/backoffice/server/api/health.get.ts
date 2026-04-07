import { defineEventHandler } from 'h3'
import { getAdminClient } from '../utils/adminClient'

export default defineEventHandler(async () => {
  const supabase = getAdminClient()

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
