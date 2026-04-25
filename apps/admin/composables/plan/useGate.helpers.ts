import { computed, type ComputedRef } from 'vue'
import type { GateResult, GateReason } from './useGate.types'

/**
 * Превратить `ComputedRef<GateResult>` в `ComputedRef<boolean>`.
 * Удобно для пропсов, ожидающих просто `visible: boolean`.
 */
export const toEnabled = (gate: ComputedRef<GateResult>): ComputedRef<boolean> => computed(() => gate.value.enabled)

/**
 * Проверить, заблокирован ли гейт по конкретной причине.
 * Использовать вместо ручного сравнения `gate.value.reason === 'locked'`,
 * чтобы изменения в приоритете причин не разносились по всему коду.
 */
export const isLockedBy = (gate: ComputedRef<GateResult>, reason: Exclude<GateReason, null>): ComputedRef<boolean> => computed(() => gate.value.reason === reason)
