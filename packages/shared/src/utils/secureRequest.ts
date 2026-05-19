/**
 * Чистая функция определения, обслуживается ли запрос по HTTPS.
 *
 * Без зависимости от h3 — тонкая обёртка `isSecureRequest(event)` живёт в
 * `server/utils/isSecureRequest.ts` каждого app и резолвит ENV (`TRUST_PROXY`).
 *
 * Прод за reverse-proxy (Coolify+Traefik): TLS терминируется на прокси,
 * `socket.encrypted` всегда false, реальный протокол приходит в `x-forwarded-proto`.
 * Без trust-proxy клиент мог бы подделать `x-forwarded-proto: https`, выманив
 * cookie с `Secure` поверх http — поэтому заголовок читаем только при явном opt-in.
 *
 * Прод (Vercel/Coolify-за-Traefik): `TRUST_PROXY=1`.
 * Dev/preview без прокси: ENV не задаётся → берётся socket.encrypted.
 */
export function pickSecureFlag(opts: {
  /** Значение `x-forwarded-proto` (если trust-proxy включён и заголовок есть). */
  trustedProtoHeader: string | undefined
  /** event.node.req.connection.encrypted — TCP TLS, не подделывается клиентом. */
  socketEncrypted: boolean | undefined
}): boolean {
  if (opts.trustedProtoHeader) {
    // x-forwarded-proto может быть chain "https,http" (несколько прокси) — берём первое
    const proto = opts.trustedProtoHeader.split(',')[0]?.trim().toLowerCase()

    if (proto) return proto === 'https'
  }

  return opts.socketEncrypted === true
}
