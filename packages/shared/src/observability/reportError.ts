import { captureException } from '@sentry/nuxt'

/**
 * Унифицированный логгер ошибок в Sentry для admin/storefront.
 *
 * Используем `@sentry/nuxt`, который автоматически выбирает правильный SDK
 * (browser у admin SPA, server у storefront SSR) в зависимости от окружения.
 *
 * Вызывать в КАЖДОМ catch-блоке или после `const { error } = ...` —
 * чтобы попавшие в Sentry ошибки имели контекст (extra payload).
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (context && Object.keys(context).length > 0) {
    captureException(error, { extra: context })
  } else {
    captureException(error)
  }
}
