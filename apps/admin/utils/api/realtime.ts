import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

type TableHandlers = {
  onInsert?: (payload: { new: Record<string, unknown> }) => void
  onUpdate?: (payload: { new: Record<string, unknown> }) => void
  onDelete?: (payload: { old: Record<string, unknown> }) => void
  onStatus?: (connected: boolean) => void
}

export const realtimeApi = {
  // Устанавливает токен авторизации для realtime-соединения.
  // Вызывать перед подпиской, если нужна авторизация канала.
  setupAuth: async (sb: SupabaseClient): Promise<void> => {
    const { data: { session } } = await sb.auth.getSession()

    if (session?.access_token) sb.realtime.setAuth(session.access_token)
  },

  // Подписывается на изменения таблицы. DELETE намеренно без фильтра —
  // удалённая строка может не содержать все поля для серверной фильтрации.
  subscribeToTable: (
    sb: SupabaseClient,
    channelKey: string,
    table: string,
    filter: string,
    handlers: TableHandlers,
  ): RealtimeChannel => {
    let ch = sb.channel(channelKey)

    if (handlers.onInsert) ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, handlers.onInsert)
    if (handlers.onUpdate) ch = ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, handlers.onUpdate)
    if (handlers.onDelete) ch = ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, handlers.onDelete)

    return ch.subscribe((status) => {
      handlers.onStatus?.(status === 'SUBSCRIBED')
    })
  },
}
