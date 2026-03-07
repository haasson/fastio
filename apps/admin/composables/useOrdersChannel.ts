import { watch, onUnmounted, type Ref } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order } from '@fastio/shared'
import { mapOrder } from '~/utils/api/orders'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Order>>()
const updateHandlers = new Set<Handler<Order>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

export const orderEvents = {
  onInsert(handler: Handler<Order>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Order>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for orders.
 */
export function useOrdersChannel(tenantId: Ref<string | null>) {
  const { $supabase } = useNuxtApp()
  let channel: RealtimeChannel | null = null

  const setup = async (id: string) => {
    const { data: { session } } = await $supabase.auth.getSession()

    if (session?.access_token) $supabase.realtime.setAuth(session.access_token)

    channel = $supabase
      .channel(`orders:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `tenant_id=eq.${id}`,
      }, ({ new: row }) => {
        const order = mapOrder(row as Record<string, unknown>)

        insertHandlers.forEach((h) => h(order))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `tenant_id=eq.${id}`,
      }, ({ new: row }) => {
        const order = mapOrder(row as Record<string, unknown>)

        updateHandlers.forEach((h) => h(order))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'orders',
      }, ({ old: row }) => {
        deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id }))
      })
      .subscribe()
  }

  watch(tenantId, (id) => {
    channel?.unsubscribe()
    channel = null
    if (id) setup(id)
  }, { immediate: true })

  onUnmounted(() => channel?.unsubscribe())
}
