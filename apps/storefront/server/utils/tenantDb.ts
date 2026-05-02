import type { H3Event } from 'h3'
import { createError } from 'h3'
import { getServerSupabase } from './supabase'

export function getTenantDb(event: H3Event) {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 400, message: 'Missing tenant context' })

  const sb = getServerSupabase()

  return {
    tenantId,
    /**
     * Таблица с tenant_id — авто-добавляет .eq('tenant_id', tenantId) после select/update/delete.
     *
     * Proxy перехватывает первый вызов select/update/delete на результате from() и вставляет
     * .eq('tenant_id') сразу после него. Обязательный паттерн: db.from('x').select('...').
     * Нельзя вставлять другие .eq()-вызовы ДО .select() — они вернут реальный QueryBuilder
     * (не Proxy), и tenant-фильтр пропадёт. В TypeScript это физически невозможно
     * (PostgrestQueryBuilder не имеет .eq()), поэтому в боевом коде ограничение не проявляется.
     */
    from(table: string) {
      const qb = sb.from(table)
      return new Proxy(qb, {
        get(target, prop) {
          if (prop === 'insert') {
            throw new Error(`db.from('${table}').insert() не поддерживается — используй db.raw.from() и явно передавай tenant_id в payload`)
          }
          if (prop === 'select' || prop === 'update' || prop === 'delete') {
            return (...args: unknown[]) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (target as any)[prop](...args).eq('tenant_id', tenantId)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const val = (target as any)[prop]
          return typeof val === 'function' ? val.bind(target) : val
        },
      })
    },
    /** Junction-таблица без tenant_id — без авто-фильтра */
    junction(table: string) {
      return sb.from(table)
    },
    raw: sb,
  }
}
