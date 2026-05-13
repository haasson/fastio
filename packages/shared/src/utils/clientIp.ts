/**
 * Чистая функция выбора client IP по приоритету:
 *   1. trusted-proxy заголовок (если значение передано),
 *   2. socket remote address.
 *
 * Без зависимости от h3 — тонкая обёртка `getClientIp(event)` живёт в каждом
 * app в `server/utils/clientIp.ts` и резолвит ENV (`TRUST_PROXY`, `TRUSTED_IP_HEADER`).
 *
 * Прод (Vercel/Coolify-за-Traefik): `TRUST_PROXY=1` + `TRUSTED_IP_HEADER=x-real-ip`.
 * Dev/preview без прокси: ENV не задаются → берётся socket.remoteAddress.
 *
 * Никогда НЕ доверяет произвольным заголовкам без явного opt-in через ENV —
 * это закрывает rate-limit/IDOR-spoof через `X-Forwarded-For`.
 */
export function pickClientIp(opts: {
  /** Значение заголовка (если trust-proxy включён и заголовок есть). */
  trustedHeaderValue: string | undefined
  /** event.node.req.socket.remoteAddress — TCP-peer, не подделывается клиентом. */
  socketRemoteAddress: string | undefined
}): string {
  if (opts.trustedHeaderValue) {
    // x-forwarded-for может быть chain "client, proxy1, proxy2" — нужен первый IP
    const ip = opts.trustedHeaderValue.split(',')[0]?.trim()

    if (ip) return ip
  }

  return opts.socketRemoteAddress ?? 'unknown'
}
