import { computed, type ComputedRef } from 'vue'
import type { PermissionKey } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useResolvedFeatures } from './useResolvedFeatures'
import { useModules, useModuleConfigs } from './useModules'
import type { ModuleKey } from '~/config/modules'
import type { GateReason, GateResult } from './useGate.types'

/**
 * Общая инфраструктура гейтов: builders, state-хуки, helpers.
 *
 * Используется тремя точками входа:
 *  - `useGate()` (legacy aggregator, в allow-list ESLint) — собирает реестр всех гейтов
 *  - `useGateServices()` (composables/services/useGate.ts) — services-only регистр
 *  - `useGateRetail()` (composables/retail/useGate.ts) — retail-only регистр
 *
 * Цель: исключить дублирование логики builders + общая state-нить (suspended/owner/perms).
 */

export const ok = (): GateResult => ({ enabled: true, reason: null })

export const deny = (reason: Exclude<GateReason, null>, extra: Partial<GateResult> = {}): GateResult => ({ enabled: false, reason, ...extra })

/**
 * Возвращает state и фабрики гейтов, привязанные к текущим store-ам.
 * Безопасно вызывать несколько раз — Pinia переиспользует существующие инстансы.
 */
export const useGateInfra = () => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const { resolved } = useResolvedFeatures()
  const modules = useModules()
  const { configs: moduleConfigs } = useModuleConfigs()

  const isSuspended = computed(() => tenantStore.maybeTenant?.subscription?.status === 'suspended')

  const isOwner = computed(() => tenantStore.isOwner)

  const hasPermission = (key: PermissionKey): boolean => {
    if (isOwner.value) return true
    const perms = tenantStore.currentPermissions

    return perms?.[key] === true
  }

  const requiredPlanFor = (moduleKey: ModuleKey): string | undefined => moduleConfigs.value.find((c) => c.key === moduleKey)?.requiredPlan

  /**
   * Гейт "фича существует на уровне тенанта" (без role-check).
   * Учитывает: suspended → absent → locked → disabled.
   */
  const moduleGate = (key: ModuleKey): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')

    const state = modules[key].value

    if (state.absent) return deny('absent')
    if (state.locked) return deny('locked', { requiredPlan: requiredPlanFor(key) })
    if (!state.active) return deny('disabled')

    return ok()
  })

  /**
   * Гейт plan-only фичи (нет в TenantModules, не переключается вручную).
   * Учитывает: suspended → locked. Без absent/disabled.
   */
  const planFeatureGate = (
    has: () => boolean,
    requiredPlan?: string,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!has()) return deny('locked', requiredPlan ? { requiredPlan } : {})

    return ok()
  })

  /**
   * Гейт компиляционного флага. Без suspended (это не доступ — это сборка).
   */
  const flagGate = (enabled: boolean): ComputedRef<GateResult> => computed(() => enabled ? ok() : deny('flag'),
  )

  /**
   * Permission-aware гейт: feature-gate + role-check.
   * Если фича недоступна на уровне тенанта — возвращаем причину тенанта.
   * Если доступна, но нет права роли — forbidden.
   */
  const permissionGate = (
    feature: ComputedRef<GateResult>,
    permKey: PermissionKey,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!feature.value.enabled) return feature.value
    if (!hasPermission(permKey)) return deny('forbidden')

    return ok()
  })

  /**
   * Гейт config-driven фичи: фича включается настройкой тенанта.
   * Учитывает: suspended → absent (через зависимый module) → locked → disabled →
   * unconfigured (если зависимый module enabled, но настройка не включена).
   */
  const configGate = (
    dependsOn: ComputedRef<GateResult>,
    isConfigured: () => boolean,
    configPath: string,
    hint: string,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!dependsOn.value.enabled) return dependsOn.value
    if (!isConfigured()) return deny('unconfigured', { configPath, hint })

    return ok()
  })

  return {
    tenantStore,
    branchStore,
    resolved,
    isSuspended,
    isOwner,
    hasPermission,
    moduleGate,
    planFeatureGate,
    flagGate,
    permissionGate,
    configGate,
  }
}
