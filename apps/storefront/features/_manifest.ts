// Машиночитаемый манифест storefront-фичи.
//
// Назначение: дать агентам/CI/доку один источник правды о том, какие у фичи
// routes / таблицы / realtime / зависимости — БЕЗ необходимости читать 20 файлов.
//
// Отличия от admin-манифеста (apps/admin/features/_manifest.ts):
//   - НЕТ permissions (на витрине нет RBAC)
//   - НЕТ tenantModule (тенант-модули гейтят админку, не витрину)
//
// Один манифест на фичу: features/<X>/feature.manifest.ts.
// Все манифесты подбираются и валидируются через
// scripts/storefront-features/validate-manifests.mjs.

export type FeatureVertical = 'retail' | 'services' | 'shared'

export type FeatureRoute = {
  path: string
  purpose: string
  layout?: string
}

export type FeatureRealtime = {
  table: string
  channelComposable: string
  events: Array<'insert' | 'update' | 'delete'>
}

export type StorefrontFeatureManifest = {
  // Уникальный ключ модуля (= имя папки).
  key: string

  // К какой вертикали относится. 'shared' — доступна обеим.
  vertical: FeatureVertical

  // Что модуль делает (одно короткое предложение, по-русски).
  purpose: string

  // Routes, которые регистрирует фича (через pages/).
  // Чисто справочно — Nuxt всё равно сканирует pages/ сам.
  routes: FeatureRoute[]

  db: {
    // Таблицы, которые фича читает/пишет напрямую (через api/* или server/api/*).
    // На витрине большинство фич идёт через Nitro endpoints (server/api/*),
    // но если есть прямой supabase.from() в client-side api/ — он сюда.
    tables: string[]
    // Имена RPC, если используются.
    rpc?: string[]
  }

  // Realtime-подписки, которые фича создаёт.
  realtime?: FeatureRealtime[]

  // На какие модули/инфру опирается:
  //   'shared.<service>'  — shared/composables/*, shared/stores/*, shared/utils/*
  //   'features.<key>'    — другой модуль (только через его barrel)
  //   '@fastio/<pkg>'     — пакет монорепо
  //   'server.<endpoint>' — Nitro-эндпоинт (например 'server.api.appointments')
  dependsOn: string[]
}

/**
 * Хелпер для type-safe объявления манифеста. Просто прокидывает аргумент,
 * но даёт автокомплит и проверку типов в IDE.
 */
export const defineFeature = (manifest: StorefrontFeatureManifest): StorefrontFeatureManifest => manifest
