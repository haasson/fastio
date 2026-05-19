import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { pickSecureFlag } from '@fastio/shared'

/**
 * Определяет, обслуживается ли текущий запрос по HTTPS, — для `secure` флага
 * выставляемых cookies.
 *
 * За reverse-proxy (Coolify+Traefik) TLS терминируется на прокси,
 * `socket.encrypted` всегда false → без чтения `x-forwarded-proto` Secure-cookie
 * никогда не выставляется, что ломает auth на проде. Без opt-in через ENV
 * заголовок не доверяем (иначе клиент мог бы выманить Secure-cookie поверх http).
 *
 * Конфиг через ENV (одинаково для storefront/admin/landing):
 *   TRUST_PROXY=1 — включить чтение `x-forwarded-proto`
 *
 * Прод (Coolify-за-Traefik) — задать TRUST_PROXY=1.
 * Dev/preview без прокси — НЕ задавать → fallback на socket.encrypted.
 */
export function isSecureRequest(event: H3Event): boolean {
  const trust = process.env.TRUST_PROXY === '1'

  return pickSecureFlag({
    trustedProtoHeader: trust ? getRequestHeader(event, 'x-forwarded-proto') : undefined,
    socketEncrypted: Boolean(event.node?.req?.socket && 'encrypted' in event.node.req.socket
      ? (event.node.req.socket as { encrypted?: boolean }).encrypted
      : false),
  })
}
