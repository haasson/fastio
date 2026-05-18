<template>
  <section class="pickup-branch-section">
    <FsHeading as="h6" class="section-title">Пункт самовывоза</FsHeading>

    <!-- Loading -->
    <div v-if="loading" class="branch-loading">
      <FsSpinner />
    </div>

    <!-- Single branch: info only -->
    <div v-else-if="singleBranch" class="branch-info" :class="{ disabled: !singleStatus?.open }">
      <div class="branch-address">{{ formatBranchAddressShort(singleBranch) }}</div>
      <a v-if="singleBranch.phone" class="branch-phone" :href="`tel:${singleBranch.phone}`">{{ singleBranch.phone }}</a>
      <div v-if="singleStatus" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(singleStatus) }">
        {{ getOpenStatusText(singleStatus, singleBranch.workingHoursSchedule) }}
      </div>
      <div v-if="singleStatus && !singleStatus.open && singleStatus.nextChange" class="branch-closed">
        Откроется {{ singleStatus.nextChange.day }} в {{ singleStatus.nextChange.time }}
      </div>
      <div v-if="branchCompat.get(singleBranch.id) === 'yellow'" class="branch-partial-note">
        Соберут не всё
      </div>
    </div>

    <!-- 2-4 branches: cards -->
    <div v-else-if="sortedBranches.length <= 4" class="branch-cards" data-testid="pickup-branch-cards">
      <button
        v-for="branch in sortedBranches"
        :key="branch.id"
        type="button"
        class="branch-card"
        data-testid="pickup-branch-card"
        :class="{
          selected: checkout.form.pickupBranchId === branch.id,
          disabled: !branchStatusByID.get(branch.id)?.open || branchCompat.get(branch.id) === 'red',
          partial: branchCompat.get(branch.id) === 'yellow',
        }"
        :disabled="!branchStatusByID.get(branch.id)?.open || branchCompat.get(branch.id) === 'red'"
        @click="selectBranch(branch.id)"
      >
        <span class="branch-address">{{ formatBranchAddressShort(branch) }}</span>
        <a v-if="branch.phone" class="branch-phone" :href="`tel:${branch.phone}`" @click.stop>{{ branch.phone }}</a>
        <span v-if="branchStatusByID.get(branch.id)" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(branchStatusByID.get(branch.id)!) }">
          {{ getOpenStatusText(branchStatusByID.get(branch.id)!, branch.workingHoursSchedule) }}
        </span>
        <span v-if="!branchStatusByID.get(branch.id)?.open && branchStatusByID.get(branch.id)?.nextChange" class="branch-closed">
          Откроется {{ branchStatusByID.get(branch.id)!.nextChange!.day }} в {{ branchStatusByID.get(branch.id)!.nextChange!.time }}
        </span>
        <span v-if="branchCompat.get(branch.id) === 'yellow'" class="branch-partial-note">
          Соберут не всё
        </span>
      </button>
    </div>

    <!-- 5+ branches: select -->
    <div v-else>
      <FsSelect
        :model-value="checkout.form.pickupBranchId"
        :options="branchOptions"
        placeholder="Выберите пункт самовывоза"
        @update:model-value="selectBranch($event as string)"
      />
      <!-- Show details of selected branch -->
      <div v-if="selectedBranch" class="branch-details">
        <div class="branch-address">{{ formatBranchAddressShort(selectedBranch) }}</div>
        <a v-if="selectedBranch.phone" class="branch-phone" :href="`tel:${selectedBranch.phone}`">{{ selectedBranch.phone }}</a>
        <div v-if="selectedBranchStatus" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(selectedBranchStatus) }">
          {{ getOpenStatusText(selectedBranchStatus, selectedBranch.workingHoursSchedule) }}
        </div>
        <div v-if="selectedBranchStatus && !selectedBranchStatus.open && selectedBranchStatus.nextChange" class="branch-closed">
          Откроется {{ selectedBranchStatus.nextChange.day }} в {{ selectedBranchStatus.nextChange.time }}
        </div>
        <div v-if="branchCompat.get(selectedBranch.id) === 'yellow'" class="branch-partial-note">
          Соберут не всё
        </div>
      </div>
    </div>

    <div v-if="error" class="branch-error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { useCheckoutStore } from '../stores/checkout'
import { useCartStore } from '~/features/cart'
import { useMenuStore } from '~/features/menu-catalog'
import { computeBranchCompat, type BranchStatus as CompatStatus } from '~/features/cart'
import { FsHeading, FsSelect, FsSpinner } from '@fastio/public-ui'
import { formatBranchAddressShort, formatWorkingHours, isOpenNow, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { BranchPublic, WorkingHoursSchedule, Tenant } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

type BranchStatus = ReturnType<typeof isOpenNow>

const CLOSING_SOON_THRESHOLD = 60 // minutes

function isClosingSoon(status: BranchStatus): boolean {
  return status.open && status.minutesUntilClose !== null && status.minutesUntilClose <= CLOSING_SOON_THRESHOLD
}

function getOpenStatusText(status: BranchStatus, schedule: WorkingHoursSchedule | null): string | null {
  if (!status.open) return formatWorkingHours(schedule)
  if (status.minutesUntilClose !== null && status.minutesUntilClose <= CLOSING_SOON_THRESHOLD) {
    const mins = status.minutesUntilClose
    const text = mins >= 60 ? `${Math.floor(mins / 60)} ч` : `${mins} мин`
    return `Закрываемся через ${text}`
  }
  if (status.closingAt) {
    return `Работаем до ${status.closingAt}`
  }
  return formatWorkingHours(schedule)
}

type PickupBranch = BranchPublic

const checkout = useCheckoutStore()
const cart = useCartStore()
const menu = useMenuStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')

const branches = ref<PickupBranch[]>([])
const loading = ref(true)
const error = ref('')

// Tick every minute so statuses stay current if the page is left open
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval>
onMounted(() => { clockTimer = setInterval(() => { now.value = new Date() }, 60_000) })
onUnmounted(() => clearInterval(clockTimer))

// Statuses keyed by branch id — устойчиво к сортировке/фильтрации.
const branchStatusByID = computed(() => {
  const map = new Map<string, BranchStatus>()
  for (const b of branches.value) {
    map.set(b.id, isOpenNow(b.workingHoursSchedule, tenant.value?.timezone ?? DEFAULT_TIMEZONE, now.value))
  }
  return map
})

// В режиме per_branch каталог уже отфильтрован под выбранный филиал —
// все позиции по определению совместимы, светофор не нужен.
const isUnified = computed(() => tenant.value?.branchSelectionMode !== 'per_branch')

const branchCompat = computed<Map<string, CompatStatus>>(() => {
  const map = new Map<string, CompatStatus>()
  if (!isUnified.value) return map
  if (branches.value.length === 0) return map
  if (cart.dishItems.length === 0) {
    for (const b of branches.value) map.set(b.id, 'green')
    return map
  }
  const dishesById = new Map(menu.allDishes.map((d) => [d.id, d]))
  const result = computeBranchCompat(
    cart.dishItems,
    dishesById,
    branches.value,
    branches.value.length,
  )
  for (const r of result) map.set(r.id, r.status)
  return map
})

const allRed = computed(() => {
  if (!isUnified.value) return false
  if (branches.value.length === 0) return false
  if (branchCompat.value.size === 0) return false
  return branches.value.every((b) => branchCompat.value.get(b.id) === 'red')
})

// Скрываем красные филиалы (не выполнят корзину) — кроме случая,
// когда красные ВСЕ: тогда показываем всех, чтобы пользователь увидел проблему.
const visibleBranches = computed(() => {
  if (!isUnified.value) return branches.value
  if (branchCompat.value.size === 0) return branches.value
  if (allRed.value) return branches.value
  return branches.value.filter((b) => branchCompat.value.get(b.id) !== 'red')
})

// Сортировка: green → yellow → red, внутри группы порядок исходного fetch'а.
const sortedBranches = computed(() => {
  if (!isUnified.value) return visibleBranches.value
  const order: Record<CompatStatus, number> = { green: 0, yellow: 1, red: 2 }
  return [...visibleBranches.value].sort((a, b) => {
    const sa = branchCompat.value.get(a.id) ?? 'green'
    const sb = branchCompat.value.get(b.id) ?? 'green'
    return order[sa] - order[sb]
  })
})

const branchOptions = computed(() =>
  sortedBranches.value.map((b) => {
    const status = branchStatusByID.value.get(b.id)
    const compat = branchCompat.value.get(b.id) ?? 'green'
    const compatSuffix = compat === 'yellow' ? ' (соберут не всё)' : ''
    const parts = [formatBranchAddressShort(b), formatWorkingHours(b.workingHoursSchedule)].filter(Boolean)
    const label = parts.join(' · ') + compatSuffix + (status?.open === false ? ' (закрыто)' : '')
    return { value: b.id, label, disabled: !status?.open || compat === 'red' }
  }),
)

const selectedBranch = computed(() =>
  branches.value.find((b) => b.id === checkout.form.pickupBranchId) ?? null,
)

const selectedBranchStatus = computed(() => {
  if (!selectedBranch.value) return null
  return branchStatusByID.value.get(selectedBranch.value.id) ?? null
})

// Шорткаты для шаблона single-branch ветки — иначе шаблон захлёбывается в `branchStatusByID.get(sortedBranches[0].id)!`.
const singleBranch = computed(() => sortedBranches.value.length === 1 ? sortedBranches.value[0] : null)
const singleStatus = computed(() => singleBranch.value ? branchStatusByID.value.get(singleBranch.value.id) ?? null : null)

function selectBranch(id: string) {
  checkout.form.pickupBranchId = id
}

onMounted(async () => {
  try {
    // Используем глобальный кэш /api/branches (D1) — без повторного запроса.
    const cached = useNuxtData<PickupBranch[]>('branches').data.value
    branches.value = cached ?? await $fetch<PickupBranch[]>('/api/branches')

    // Auto-select if single open branch — но только если он совместим с корзиной.
    // Красный единственный филиал не автоселектим, чтобы клиент увидел предупреждение.
    if (sortedBranches.value.length === 1) {
      const only = sortedBranches.value[0]
      const open = branchStatusByID.value.get(only.id)?.open
      const compat = branchCompat.value.get(only.id) ?? 'green'
      if (open && compat !== 'red') {
        checkout.form.pickupBranchId = only.id
      }
    }
  } catch (e) {
    reportError(e, { context: 'CheckoutPickupBranch:loadBranches' })
    error.value = 'Не удалось загрузить пункты самовывоза'
  } finally {
    loading.value = false
  }
})

// Returns error message or null. Also sets error.value for inline display.
function validate(): string | null {
  if (branches.value.length === 0) {
    error.value = 'Нет доступных точек самовывоза'
    return error.value
  }
  if (!checkout.form.pickupBranchId) {
    error.value = 'Выберите пункт самовывоза'
    return error.value
  }
  const status = branchStatusByID.value.get(checkout.form.pickupBranchId)
  if (status && !status.open) {
    error.value = 'Выбранный пункт сейчас закрыт'
    return error.value
  }
  if (branchCompat.value.get(checkout.form.pickupBranchId) === 'red') {
    error.value = 'Выбранный филиал не выполнит ваш заказ'
    return error.value
  }
  error.value = ''
  return null
}

defineExpose({ validate })
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.pickup-branch-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  margin: 0 0 16px;
}

.branch-loading {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.branch-info {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.disabled {
    opacity: 0.5;
  }
}

.branch-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    background: var(--color-surface);
  }

  &.selected {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  &.partial {
    border-color: var(--color-warning);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      background: transparent;
    }
  }
}

.branch-address {
  @include text-xs;
  color: var(--color-text-secondary);
}

.branch-phone {
  @include text-xs;
  color: var(--color-text-secondary);
  text-decoration: none;
  align-self: flex-start;

  &:hover {
    text-decoration: underline;
  }
}

.branch-hours {
  @include text-xs;
  color: var(--color-text-secondary);

  &.closing-soon {
    color: var(--color-warning);
  }
}

.branch-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.branch-closed {
  @include text-xs;
  color: var(--color-error);
}

.branch-partial-note {
  @include text-xs;
  color: var(--color-warning);
  font-style: italic;
}

.branch-error {
  @include text-xs;
  color: var(--color-error);
  margin-top: 8px;
}
</style>
