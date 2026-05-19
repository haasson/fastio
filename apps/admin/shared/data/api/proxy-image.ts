import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'

// Маппинг status → user-facing сообщение синхронизирован с edge function `proxy-image`
function messageForStatus(status: number | undefined): string {
  if (status === 401) return 'Сессия истекла, войдите снова'
  if (status === 403) return 'Загрузка с этого домена недоступна'
  if (status === 413) return 'Изображение слишком большое (макс. 10 МБ)'
  if (status === 422) return 'Ссылка не ведёт на изображение'
  if (status === 429) return 'Слишком много запросов, попробуйте через минуту'
  if (status === 503) return 'Сервис временно недоступен, попробуйте позже'
  if (status === 504) return 'Удалённый сервер не ответил вовремя'

  return 'Не удалось загрузить'
}

export const proxyImageApi = {
  // Загружает картинку по внешнему URL через edge function `proxy-image`.
  // Edge function: авторизованный пользователь, SSRF-чек, лимит 10 MB, rate-limit.
  // sb.functions.invoke сам подкладывает Authorization из текущей сессии.
  async fetchAsBlob(sb: SupabaseClient, url: string): Promise<Blob> {
    const { data, error } = await sb.functions.invoke<Blob>('proxy-image', {
      body: { url },
    })

    if (error) {
      if (error instanceof FunctionsHttpError) {
        throw new Error(messageForStatus(error.context.status))
      }
      throw new Error('Не удалось загрузить')
    }

    if (!(data instanceof Blob)) throw new Error('Не удалось загрузить')

    return data
  },
}
