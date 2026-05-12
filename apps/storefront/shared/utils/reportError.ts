import { captureException } from '@sentry/nuxt'

export function reportError(error: unknown) {
  captureException(error)
}
