import { captureException } from '@sentry/nuxt'

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (context && Object.keys(context).length > 0) {
    captureException(error, { extra: context })
  } else {
    captureException(error)
  }
}
