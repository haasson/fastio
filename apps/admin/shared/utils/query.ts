import { reportError } from '@fastio/shared/observability'

type SupabaseLikeError = {
  message: string
  code?: string
  hint?: string | null
  details?: string | null
}

/**
 * Маппинг PostgREST/Postgres-кодов в дружелюбные сообщения для юзера.
 * Возвращает локализованную строку — НЕ сырую `error.message` (там может быть
 * `duplicate key value violates unique constraint xxx_pkey` и т.п.).
 */
function mapPgErrorToUserMessage(error: SupabaseLikeError): string {
  switch (error.code) {
    case '23505': return 'Запись с такими данными уже существует'
    case '23503': return 'Связанная запись не найдена'
    case '23502': return 'Не заполнено обязательное поле'
    case '23514': return 'Данные не прошли проверку'
    case '22001': return 'Значение слишком длинное'
    case '42501': return 'Недостаточно прав'
    case 'PGRST116': return 'Запись не найдена'
    case 'PGRST301': return 'Доступ запрещён'
    default: return 'Ошибка сохранения. Попробуйте ещё раз.'
  }
}

export const query = async <T>(
  promise: PromiseLike<{ data: T; error: SupabaseLikeError | null }>,
): Promise<T> => {
  const { data, error } = await promise

  if (error) {
    console.error('[Supabase]', error.message, error)
    reportError(error, {
      context: 'supabase-query',
      code: error.code,
      hint: error.hint,
      details: error.details,
    })
    const userMessage = mapPgErrorToUserMessage(error)

    throw new Error(userMessage)
  }

  return data
}
