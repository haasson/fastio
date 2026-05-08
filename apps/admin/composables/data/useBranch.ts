import { ref, computed, watch, type Ref } from 'vue'
import type { Branch } from '@fastio/shared'

const STORAGE_KEY = 'fastio_current_branch'

export const useBranch = (
  tenantId: Ref<string>,
  branches: Ref<Branch[]>,
  memberBranchIds: Ref<string[]>,
  hasAllBranchAccess: Ref<boolean>,
) => {
  const currentBranchId = ref<string | null>(null)

  // null = "все филиалы"
  const currentBranch = computed(() => currentBranchId.value
    ? branches.value.find((b) => b.id === currentBranchId.value) ?? null
    : null,
  )

  const hasBranches = computed(() => branches.value.length > 0)

  // Флаг инициализации: хранит tenantId, для которого уже выбрали currentBranchId.
  // Сбрасывается при смене тенанта, чтобы init сработал заново.
  const initializedForTenantId = ref<string | null>(null)

  // Сбрасываем выбранный филиал ТОЛЬКО при реальной смене тенанта (oldVal был не-null).
  // Первое срабатывание (null → реальный tid) — это не смена, а инициализация:
  // сразу после неё `watch(branches)` восстановит filial из localStorage.
  watch(tenantId, (newVal, oldVal) => {
    if (!oldVal) return
    currentBranchId.value = null
    localStorage.removeItem(STORAGE_KEY)
    initializedForTenantId.value = null
  })

  // Инициализируем currentBranchId сразу после загрузки первого батча филиалов тенанта
  watch(branches, (newBranches) => {
    const tid = tenantId.value

    if (!tid || initializedForTenantId.value === tid) return

    if (newBranches.length === 0) return

    initializedForTenantId.value = tid

    const available = hasAllBranchAccess.value || memberBranchIds.value.length === 0
      ? newBranches
      : newBranches.filter((b) => memberBranchIds.value.includes(b.id))

    const saved = localStorage.getItem(STORAGE_KEY)
    const savedAll = saved === 'all' && (hasAllBranchAccess.value || memberBranchIds.value.length === 0)
    const savedValid = saved && saved !== 'all' && available.some((b) => b.id === saved)

    if (savedAll) {
      currentBranchId.value = null
    } else if (savedValid) {
      currentBranchId.value = saved
    } else if (hasAllBranchAccess.value || memberBranchIds.value.length === 0) {
      // Участник с доступом ко всем филиалам — по умолчанию "все"
      currentBranchId.value = null
    } else {
      // Сотрудник с ограниченным доступом — первый доступный
      currentBranchId.value = available[0]?.id ?? null
      if (currentBranchId.value) localStorage.setItem(STORAGE_KEY, currentBranchId.value)
    }
  }, { immediate: true })

  const setBranch = (id: string | null) => {
    currentBranchId.value = id
    localStorage.setItem(STORAGE_KEY, id ?? 'all')
  }

  const dispose = () => {
    currentBranchId.value = null
    initializedForTenantId.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { currentBranchId, currentBranch, hasBranches, setBranch, dispose }
}
