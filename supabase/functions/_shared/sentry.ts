// Lightweight Sentry helper для Deno edge-функций.
//
// Активируется только если задан ENV `SENTRY_DSN` (для self-hosted Supabase —
// через `.env` контейнера `supabase-edge-runtime`; managed CLI'шный
// `supabase secrets set` тоже работает). Без DSN все вызовы no-op — функции
// продолжают работать как раньше, ошибки идут только в console.error / edge-logs.
//
// Используй `withSentry('fn-name', handler)` вокруг `Deno.serve(...)` — uncaught
// exceptions автоматически уходят в Sentry с тегом `fn` + flush перед возвратом
// ответа. Для ручного отчёта (captureMessage из success-path) — после вызова
// дёрни `await flushSentry()`, иначе на edge-runtime событие может не уйти до
// termination воркера.

import * as Sentry from '@sentry/deno'

const dsn = Deno.env.get('SENTRY_DSN')
// Default 'unknown' (а не 'production'): если кто-то прокинет prod-DSN в локалку
// и забудет SENTRY_ENVIRONMENT — события не засрут прод-проект ложными issue.
const environment = Deno.env.get('SENTRY_ENVIRONMENT') ?? 'unknown'
// tracesSampleRate тюнится без передеплоя функций — менять только env, рестарт runtime.
const tracesSampleRate = Number(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE') ?? '0.1')

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
  })
}

export const sentryEnabled = Boolean(dsn)

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'error',
  context?: Record<string, unknown>,
) {
  if (!sentryEnabled) return
  Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

// Edge-runtime может терминейтить воркер сразу после return — без явного flush
// async-отправка события в Sentry не успевает уйти по сети. Вызывай после любых
// captureException/captureMessage из success-path. В catch-ветке withSentry
// уже делает flush сам.
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!sentryEnabled) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    // network / timeout — событие потеряно, но handler не падает из-за этого
  }
}

// Оборачивает основной handler edge-функции: ловит uncaught throw, шлёт в Sentry,
// flush'ит до возврата 500 (иначе воркер terminate'ится с событием в очереди).
// Не глотает HTTP 4xx/5xx, которые сам вернул handler.
export function withSentry(
  fn: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req)
    } catch (err) {
      captureException(err, { fn, url: req.url, method: req.method })
      console.error(`[${fn}] uncaught:`, err)
      await flushSentry()
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
