// Вспомогательные функции для payment-webhook — вынесены сюда чтобы их можно было
// unit-тестить без Deno.serve / реальных env / HTTP-моков.

export type HmacResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_format' | 'invalid_signature' }

/**
 * Проверяет HMAC-SHA256 подпись webhook'а ЮKassa.
 *
 * Подпись приходит в заголовке `Content-Signature` в формате `v1=<hex_hmac>`.
 * Принимаем также голый hex без `v1=` — на случай если ЮKassa поменяет схему
 * версионирования (затраты минимальны, безопасность не страдает: сам HMAC
 * проверяется в любом случае). Хекс должен быть валидным [0-9a-f] и иметь
 * чётную длину; иначе → invalid_format. HMAC-сравнение делается через
 * `crypto.subtle.verify` (constant-time, см. Web Crypto spec).
 *
 * @param body - сырое тело запроса (req.text()), не парсим в JSON до проверки
 * @param signature - значение Content-Signature header (с `v1=` или без)
 * @param secretKey - YOOKASSA_WEBHOOK_SECRET
 */
export async function verifyYookassaHmac(
  body: string,
  signature: string,
  secretKey: string,
): Promise<HmacResult> {
  const hexSig = signature.startsWith('v1=') ? signature.slice(3) : signature

  if (!/^[0-9a-f]+$/i.test(hexSig)) {
    return { ok: false, reason: 'invalid_format' }
  }

  // Фикс прежнего инлайн-кода в index.ts: без этой проверки .match(/.{2}/g)
  // тихо дропал последний символ при нечётной длине, и HMAC всегда был invalid
  // (без указания что дело в формате). Возвращаем invalid_format — точнее для
  // клиента и для логов.
  if (hexSig.length % 2 !== 0) {
    return { ok: false, reason: 'invalid_format' }
  }

  const hexBytes = hexSig.match(/.{2}/g)
  if (!hexBytes) return { ok: false, reason: 'invalid_format' }

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const sigBytes = new Uint8Array(hexBytes.map((b) => parseInt(b, 16)))
  const isValid = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    sigBytes,
    encoder.encode(body),
  )

  return isValid ? { ok: true } : { ok: false, reason: 'invalid_signature' }
}
