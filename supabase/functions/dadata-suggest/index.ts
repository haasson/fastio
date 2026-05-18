import { createClient } from '@supabase/supabase-js'
import { captureException, flushSentry, withSentry } from '../_shared/sentry.ts'

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

Deno.serve(withSentry('dadata-suggest', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Авторизация — Bearer JWT (любой пользователь Supabase). Защита от анонимного спама квоты DaData.
  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = Deno.env.get('DADATA_API_KEY')
  if (!apiKey) {
    return json({ suggestions: [] })
  }

  const { query } = await req.json() as { query?: string }

  if (!query || query.length < 3) {
    return json({ suggestions: [] })
  }

  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({ query, count: 5 }),
      // Hard cap 5s: DaData transient (5xx/network/DNS) не должен держать edge-воркер
      // дольше — Deno AbortSignal.timeout стреляет DOMException('TimeoutError') (PREPROD-010).
      signal: AbortSignal.timeout(5000),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    // Graceful degrade: фронт получает пустой массив и юзер вводит руками. Но
    // ошибку всё равно репортим в Sentry — иначе DaData может молча лежать сутками,
    // а мы заметим только по жалобам (feedback_always_log_errors).
    captureException(e, { fn: 'dadata-suggest', stage: 'upstream-fetch' })
    // flush ОБЯЗАТЕЛЕН: на edge-runtime воркер может terminate'нуться сразу после
    // return, async-отправка в Sentry не успеет уйти по сети → потеря события на
    // cold start. withSentry-обёртка делает flush только для uncaught throw'ов
    // (catch внутри handler'а — не uncaught).
    await flushSentry()
    return json({ suggestions: [] })
  }
}))
