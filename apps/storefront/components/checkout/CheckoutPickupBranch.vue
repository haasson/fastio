<template>
  <section class="pickup-branch-section">
    <FsHeading as="h6" class="section-title">Пункт самовывоза</FsHeading>

    <!-- Loading -->
    <div v-if="loading" class="branch-loading">
      <FsSpinner />
    </div>

    <!-- Single branch: info only -->
    <div v-else-if="branches.length === 1" class="branch-info" :class="{ disabled: !branchStatuses[0]?.open }">
      <div v-if="branches[0].address" class="branch-address">{{ branches[0].address }}</div>
      <a v-if="branches[0].phone" class="branch-phone" :href="`tel:${branches[0].phone}`">{{ branches[0].phone }}</a>
      <div v-if="branchStatuses[0]" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(branchStatuses[0]) }">
        {{ getOpenStatusText(branchStatuses[0], branches[0].workingHoursSchedule) }}
      </div>
      <div v-if="branchStatuses[0] && !branchStatuses[0].open && branchStatuses[0].nextChange" class="branch-closed">
        Откроется {{ branchStatuses[0].nextChange.day }} в {{ branchStatuses[0].nextChange.time }}
      </div>
    </div>

    <!-- 2-4 branches: cards -->
    <div v-else-if="branches.length <= 4" class="branch-cards">
      <button
        v-for="(branch, idx) in branches"
        :key="branch.id"
        type="button"
        class="branch-card"
        :class="{ selected: checkout.form.pickupBranchId === branch.id, disabled: !branchStatuses[idx]?.open }"
        :disabled="!branchStatuses[idx]?.open"
        @click="selectBranch(branch.id)"
      >
        <span v-if="branch.address" class="branch-address">{{ branch.address }}</span>
        <a v-if="branch.phone" class="branch-phone" :href="`tel:${branch.phone}`" @click.stop>{{ branch.phone }}</a>
        <span v-if="branchStatuses[idx]" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(branchStatuses[idx]!) }">
          {{ getOpenStatusText(branchStatuses[idx]!, branch.workingHoursSchedule) }}
        </span>
        <span v-if="!branchStatuses[idx]?.open && branchStatuses[idx]?.nextChange" class="branch-closed">
          Откроется {{ branchStatuses[idx].nextChange!.day }} в {{ branchStatuses[idx].nextChange!.time }}
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
        <div v-if="selectedBranch.address" class="branch-address">{{ selectedBranch.address }}</div>
        <a v-if="selectedBranch.phone" class="branch-phone" :href="`tel:${selectedBranch.phone}`">{{ selectedBranch.phone }}</a>
        <div v-if="selectedBranchStatus" class="branch-hours" :class="{ 'closing-soon': isClosingSoon(selectedBranchStatus) }">
          {{ getOpenStatusText(selectedBranchStatus, selectedBranch.workingHoursSchedule) }}
        </div>
        <div v-if="selectedBranchStatus && !selectedBranchStatus.open && selectedBranchStatus.nextChange" class="branch-closed">
          Откроется {{ selectedBranchStatus.nextChange.day }} в {{ selectedBranchStatus.nextChange.time }}
        </div>
      </div>
    </div>

    <div v-if="error" class="branch-error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { useCheckoutStore } from '~/stores/checkout'
import { FsHeading, FsSelect, FsSpinner } from '@fastio/public-ui'
import { formatWorkingHours, isOpenNow, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { WorkingHoursSchedule, Tenant } from '@fastio/shared'

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

type PickupBranch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  workingHoursSchedule: WorkingHoursSchedule | null
}

const checkout = useCheckoutStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')

const branches = ref<PickupBranch[]>([])
const loading = ref(true)
const error = ref('')

// Tick every minute so statuses stay current if the page is left open
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval>
onMounted(() => { clockTimer = setInterval(() => { now.value = new Date() }, 60_000) })
onUnmounted(() => clearInterval(clockTimer))

const branchStatuses = computed(() =>
  branches.value.map((b) =>
    isOpenNow(b.workingHoursSchedule, tenant.value?.timezone ?? DEFAULT_TIMEZONE, now.value)
  )
)

const branchOptions = computed(() =>
  branches.value.map((b, idx) => {
    const status = branchStatuses.value[idx]
    const parts = [b.address || b.name, formatWorkingHours(b.workingHoursSchedule)].filter(Boolean)
    const label = parts.join(' · ') + (status?.open === false ? ' (закрыто)' : '')
    return { value: b.id, label, disabled: !status?.open }
  })
)

const selectedBranch = computed(() =>
  branches.value.find((b) => b.id === checkout.form.pickupBranchId) ?? null
)

const selectedBranchStatus = computed(() => {
  const idx = branches.value.findIndex((b) => b.id === checkout.form.pickupBranchId)
  return idx !== -1 ? branchStatuses.value[idx] : null
})

function selectBranch(id: string) {
  checkout.form.pickupBranchId = id
}

onMounted(async () => {
  try {
    branches.value = await $fetch<PickupBranch[]>('/api/branches')

    // Auto-select if single open branch
    if (branches.value.length === 1 && branchStatuses.value[0]?.open) {
      checkout.form.pickupBranchId = branches.value[0].id
    }
  } catch {
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
  const selectedIdx = branches.value.findIndex((b) => b.id === checkout.form.pickupBranchId)
  if (selectedIdx !== -1 && !branchStatuses.value[selectedIdx]?.open) {
    error.value = 'Выбранный пункт сейчас закрыт'
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
  color: var(--color-text-muted);

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

.branch-error {
  @include text-xs;
  color: var(--color-error);
  margin-top: 8px;
}
</style>
