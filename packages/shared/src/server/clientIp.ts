import type { H3Event } from 'h3'
import { getHeader } from 'h3'

import { pickClientIp } from '../utils/clientIp'

/**
 * Реальный IP клиента для rate-limit / IDOR-guard.
 *
 * Конфиг через ENV (одинаково для storefront/admin/landing):
 *   TRUST_PROXY=1                — включить чтение proxy-заголовков
 *   TRUSTED_IP_HEADER=x-real-ip  — какой заголовок считать source-of-truth
 *
 * Прод (Vercel + Coolify-за-Traefik) — задать обе переменные.
 * Dev/preview без прокси — НЕ задавать → fallback на socket.remoteAddress.
 */
export function getClientIp(event: H3Event): string {
  const trust = process.env.TRUST_PROXY === '1'
  const headerName = process.env.TRUSTED_IP_HEADER || 'x-real-ip'

  return pickClientIp({
    trustedHeaderValue: trust ? getHeader(event, headerName) : undefined,
    socketRemoteAddress: event.node?.req?.socket?.remoteAddress,
  })
}
