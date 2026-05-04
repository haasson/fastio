import type { H3Event } from 'h3'
import { createError } from 'h3'
import { getServerSupabase } from './supabase'

/**
 * Список таблиц с колонкой `tenant_id` в схеме public.
 *
 * Источник правды — `information_schema.columns` в БД. Сверка идёт через
 * integration-тест `__tests__/tenantTablesDrift.test.ts` (запускается с
 * флагом `RUN_TENANT_TABLES_DRIFT_CHECK=1` против живого supabase). Если
 * добавилась новая tenant-таблица и забыли обновить set — тест упадёт.
 *
 * Получить актуальный список руками:
 *   docker exec supabase_db_fastio psql -U postgres -d postgres -t -A \
 *     -c "SELECT table_name FROM information_schema.columns
 *         WHERE table_schema='public' AND column_name='tenant_id'
 *         ORDER BY table_name;"
 */
export const TENANT_TABLES = new Set<string>([
  'addon_presets',
  'addons',
  'appointment_events',
  'appointment_groups',
  'appointment_settings',
  'appointments',
  'audit_logs',
  'banners',
  'billing_transactions',
  'branches',
  'categories',
  'combo_tag_assignments',
  'combos',
  'customer_sessions',
  'customers',
  'delivery_zones',
  'dish_tag_assignments',
  'dish_tags',
  'dishes',
  'galleries',
  'gallery_photos',
  'kitchen_queue',
  'modifier_groups',
  'order_events',
  'order_items',
  'order_notes',
  'order_number_counters',
  'order_statuses',
  'orders',
  'pending_telegram_auths',
  'promo_codes',
  'promotions',
  'reservation_settings',
  'reservations',
  'resources',
  'schedule_templates',
  'services',
  'support_tickets',
  'table_call_types',
  'table_calls',
  'tables',
  'telegram_link_codes',
  'tenant_invitations',
  'tenant_members',
  'tenant_roles',
])

export function getTenantDb(event: H3Event) {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 400, message: 'Missing tenant context' })

  const sb = getServerSupabase()

  /**
   * Создаёт Proxy над from(table), который авто-инжектит `.eq('tenant_id', tenantId)`
   * после select/update/delete. Insert запрещён — нужен `.crossTenant.from().insert()`
   * с явным tenant_id в payload.
   */
  function wrapTenantTable(table: string) {
    const qb = sb.from(table)
    return new Proxy(qb, {
      get(target, prop) {
        if (prop === 'insert') {
          throw createError({
            statusCode: 500,
            message: `db.from('${table}').insert() не поддерживается — используй db.crossTenant.from() и явно передавай tenant_id в payload`,
          })
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
  }

  /**
   * Proxy над голым клиентом. Перехватывает `from(table)`: если table — известная
   * tenant-таблица, возвращает обёрнутый QueryBuilder с авто tenant-фильтром.
   * Для всех остальных вызовов (.rpc, .channel, .auth и т.д.) — pass-through.
   *
   * Это страховка от случайного `db.raw.from('branches')` без `.eq('tenant_id', ...)`:
   * раньше такой запрос отдавал данные чужого тенанта (service_role байпасит RLS).
   */
  const rawProxy = new Proxy(sb, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          if (TENANT_TABLES.has(table)) return wrapTenantTable(table)
          return target.from(table)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (target as any)[prop]
      return typeof val === 'function' ? val.bind(target) : val
    },
  })

  return {
    tenantId,
    /**
     * Таблица с tenant_id — авто-добавляет .eq('tenant_id', tenantId) после select/update/delete.
     *
     * ВАЖНО: Proxy перехватывает только первый вызов select/update/delete на результате from() —
     * после него возвращается реальный QueryBuilder, и tenant-фильтр там уже не появится.
     * Обязательный паттерн: db.from('x').select('...'). Нельзя вставлять .eq() ДО .select() —
     * tenant-фильтр пропадёт. В TypeScript это физически невозможно (PostgrestQueryBuilder
     * не имеет .eq() до select), поэтому в боевом коде ограничение не проявляется. Тест
     * фиксирующий это поведение: tenantDb.test.ts → "ставит eq до select".
     */
    from(table: string) {
      return wrapTenantTable(table)
    },
    /** Junction-таблица без собственного tenant_id (защита через RLS+JOIN на parent). */
    junction(table: string) {
      return sb.from(table)
    },
    /**
     * Service-role клиент с защитой: `from(<tenant-таблица>)` авто-инжектит tenant-фильтр.
     * Для RPC, channel, auth — pass-through. Если нужен УМЫШЛЕННЫЙ cross-tenant
     * (миграции, бэкграунд-задачи) — используй `db.crossTenant`.
     */
    raw: rawProxy,
    /**
     * Голый service-role клиент БЕЗ защиты. Использовать только для умышленных
     * cross-tenant операций (платёжный webhook без контекста, фоновые миграции).
     * В обычных endpoint'ах НЕ нужен — используй `db.from()` или `db.raw`.
     */
    crossTenant: sb,
  }
}
