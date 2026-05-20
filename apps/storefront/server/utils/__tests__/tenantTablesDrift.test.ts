/**
 * Drift-check для TENANT_TABLES в `tenantDb.ts`.
 *
 * Цель: если кто-то добавил новую таблицу с колонкой `tenant_id` и забыл
 * обновить TENANT_TABLES — Proxy в `db.raw.from(...)` пропустит запрос без
 * tenant-фильтра, и service_role отдаст данные чужого тенанта.
 *
 * Запуск:
 *   RUN_TENANT_TABLES_DRIFT_CHECK=1 \
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt> \
 *   pnpm vitest run apps/storefront/server/utils/__tests__/tenantTablesDrift.test.ts
 *
 * Без флага тест скипается, чтобы не блокировать обычный `pnpm test:run`
 * (где живая БД может быть недоступна). В CI флаг включён (PREPROD-225),
 * но без SUPABASE_URL/KEY тест тоже скипается — там нет живой БД. Реальная
 * проверка проходит на nightly-job с поднятым supabase.
 */

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { TENANT_TABLES } from '../tenantDb'

const enabled = process.env.RUN_TENANT_TABLES_DRIFT_CHECK === '1'
  && Boolean(process.env.SUPABASE_URL)
  && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

describe.skipIf(!enabled)('TENANT_TABLES drift check (live DB)', () => {
  it('совпадает с information_schema.columns', async () => {
    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const sb = createClient(url, key)
    const { data, error } = await sb
      .from('information_schema.columns' as never)
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('column_name', 'tenant_id')

    if (error) {
      const { data: rpcData, error: rpcError } = await sb.rpc('list_tenant_tables' as never)
      if (rpcError) {
        throw new Error(`Не удалось получить список tenant-таблиц: ${error.message} / ${rpcError.message}`)
      }
      const actual = new Set<string>((rpcData as { table_name: string }[]).map(r => r.table_name))
      assertNoDrift(actual)
      return
    }

    const actual = new Set<string>((data as { table_name: string }[]).map(r => r.table_name))
    assertNoDrift(actual)
  })
})

function assertNoDrift(actual: Set<string>) {
  const declared = TENANT_TABLES
  const missing = [...actual].filter(t => !declared.has(t)).sort()
  const stale = [...declared].filter(t => !actual.has(t)).sort()

  expect(missing, `Не задекларированы в TENANT_TABLES: ${missing.join(', ')}`).toEqual([])
  expect(stale, `В TENANT_TABLES есть таблицы которых нет в БД: ${stale.join(', ')}`).toEqual([])
}
