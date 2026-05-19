import { defineNitroPlugin } from 'nitropack/runtime'
import { buildNonceInjector } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

/**
 * Приклеивает per-request nonce ко всем inline-скриптам в SSR-рендере.
 * Nonce генерится в `middleware/0-security-headers.ts` и кладётся в
 * `event.context.cspNonce`. Здесь — единственное место, где `<script>` без
 * `nonce` атрибута получает его автоматически (включая Nuxt SSR payload
 * `<script>window.__NUXT__=…</script>` и hydration scripts).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = event.context.cspNonce

    if (!nonce) return

    try {
      const inject = buildNonceInjector(nonce)

      html.head = html.head.map(inject)
      html.bodyPrepend = html.bodyPrepend.map(inject)
      html.body = html.body.map(inject)
      html.bodyAppend = html.bodyAppend.map(inject)
    } catch (err) {
      // CSP-инжекция сломала рендер — лучше отдать страницу без nonce
      // (браузер заблокирует inline-скрипты, страница плохо работает),
      // чем вернуть 500 на любой ошибке regex/replace. Sentry увидит.
      reportError(err as Error, { context: 'csp-nonce:render-html' })
    }
  })
})
