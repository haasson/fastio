/**
 * Sentinel errors для distinguishable error-handling. Используй вместо message-
 * сравнения (which is fragile — локализация / переименование сломают guard).
 *
 * Пример:
 *   } catch (e) {
 *     if (e instanceof NotAuthenticatedError) return // guest by design, не логируем
 *     reportError(e, { context: '...' })
 *   }
 */

/**
 * Бросается helper'ами вроде getAuthHeader() когда юзер не залогинен.
 * Это by-design кейс (гостевой режим витрины), Sentry о нём знать не должен.
 */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'NotAuthenticatedError'
  }
}
