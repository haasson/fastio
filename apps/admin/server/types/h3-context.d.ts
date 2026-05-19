import 'h3'

declare module 'h3' {
  interface H3EventContext {
    /**
     * Per-request CSP nonce (144 bit). Заполняется `middleware/0-security-headers.ts`,
     * читается `plugins/csp-nonce.ts` для инжекции в inline-скрипты.
     */
    cspNonce?: string
  }
}
