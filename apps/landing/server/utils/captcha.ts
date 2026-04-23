import { $fetch } from 'ofetch'

// Yandex SmartCaptcha — server-side verification.
// Документация: https://yandex.cloud/docs/smartcaptcha/concepts/validation
const VERIFY_URL = 'https://smartcaptcha.yandexcloud.net/validate'

type VerifyResponse = {
  status: 'ok' | 'failed'
  message?: string
  host?: string
}

// Если serverKey пустой — скипаем в dev для локальной разработки без ключей.
// В проде отсутствие ключа = отказ: молча отключать защиту от ботов нельзя.
export async function verifyCaptcha(token: string | undefined, serverKey: string, ip: string): Promise<boolean> {
  if (!serverKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[captcha] YANDEX_CAPTCHA_SERVER_KEY is empty in production — refusing to skip check')
      return false
    }
    return true
  }
  if (!token) return false

  try {
    const res = await $fetch<VerifyResponse>(VERIFY_URL, {
      method: 'GET',
      query: { secret: serverKey, token, ip },
    })

    return res.status === 'ok'
  } catch {
    return false
  }
}
