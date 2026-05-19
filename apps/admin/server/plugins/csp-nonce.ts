import { defineNitroPlugin } from 'nitropack/runtime'
import { buildNonceInjector } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

/**
 * Приклеивает per-request nonce ко всем inline-скриптам.
 * Nonce генерится в `middleware/0-security-headers.ts`. В admin SPA-режиме
 * (`ssr: false` в prod) Nuxt всё равно инжектит inline `<script>` с runtimeConfig
 * в HTML shell — без nonce они блокируются новым CSP.
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
      reportError(err as Error, { context: 'csp-nonce:render-html' })
    }
  })
})
