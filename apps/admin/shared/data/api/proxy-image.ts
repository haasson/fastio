import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'

// Маппинг status → user-facing сообщение синхронизирован с edge function `proxy-image`.
// 500/502/504 — сетевой провал загрузки по ссылке (частая причина: западные CDN
// типа Unsplash/Pixabay дропают коннект с нашего IP). Чинить гео-блок мы не можем,
// поэтому подсказываем рабочий путь — скачать и загрузить файлом.
const LINK_FAILED = 'Не удалось загрузить по ссылке. Скачайте картинку и загрузите файлом с компьютера'

function messageForStatus(status: number | undefined): string {
  if (status === 401) return 'Сессия истекла, войдите снова'
  if (status === 403) return 'Загрузка с этого домена недоступна'
  if (status === 413) return 'Изображение слишком большое (макс. 10 МБ)'
  if (status === 422) return 'Ссылка не ведёт на изображение'
  if (status === 429) return 'Слишком много запросов, попробуйте через минуту'
  if (status === 503) return 'Сервис временно недоступен, попробуйте позже'

  // 500 / 502 / 504 и прочее — сетевой провал загрузки по ссылке
  return LINK_FAILED
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
      throw new Error(LINK_FAILED)
    }

    if (!(data instanceof Blob)) throw new Error(LINK_FAILED)

    return data
  },
}
