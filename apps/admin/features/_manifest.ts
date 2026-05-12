// Машиночитаемый манифест модуля.
//
// Назначение: дать агентам/CI/доку один источник правды о том, какие у фичи
// routes / permissions / таблицы / realtime / зависимости — БЕЗ необходимости
// читать 20 файлов и собирать пазл.
//
// Один манифест на фичу: features/<X>/feature.manifest.ts.
// Все манифесты подбираются и валидируются через scripts/features/validate-manifests.mjs.

import type { ModuleKey } from '~/config/modules'

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

export type FeatureManifest = {
  // Уникальный ключ модуля. Если фича соответствует TenantModule — совпадает с ModuleKey.
  // Для не-модульных фич (auth, billing, settings) используется свободный slug.
  key: ModuleKey | string

  // К какой вертикали относится. 'shared' — доступна обеим.
  vertical: FeatureVertical

  // Что модуль делает (одно короткое предложение, по-русски).
  purpose: string

  // Привязан ли модуль к TenantModule (включается/выключается тенантом).
  tenantModule: boolean

  // Routes, которые регистрирует фича (через pages/).
  // Чисто справочно — Nuxt всё равно сканирует pages/ сам.
  routes: FeatureRoute[]

  // Ключи permissions из config/team-roles.ts.
  permissions: string[]

  db: {
    // Таблицы, которые фича читает/пишет напрямую (через api/*).
    tables: string[]
    // Имена RPC (postgres functions), если используются.
    rpc?: string[]
  }

  // Realtime-подписки, которые фича создаёт. Обычно подписка одна, на основную таблицу.
  realtime?: FeatureRealtime[]

  // На какие модули/инфру опирается. Используется для:
  //   - подсветки кросс-модульных импортов
  //   - проверки изоляции вертикалей (retail не должен зависеть от services)
  // Форматы:
  //   'shared.<service>'  — shared/data/*, shared/stores/*, shared/utils/*
  //   'features.<key>'    — другой модуль (только через его barrel)
  //   '@fastio/<pkg>'     — пакет монорепо
  dependsOn: string[]
}

/**
 * Хелпер для type-safe объявления манифеста. Просто прокидывает аргумент,
 * но даёт автокомплит и проверку типов в IDE.
 */
export const defineFeature = (manifest: FeatureManifest): FeatureManifest => manifest
