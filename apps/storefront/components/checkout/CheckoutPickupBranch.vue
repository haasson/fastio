<template>
  <section class="pickup-branch-section">
    <FsHeading as="h6" class="section-title">Пункт самовывоза</FsHeading>

    <!-- Loading -->
    <div v-if="loading" class="branch-loading">
      <FsSpinner />
    </div>

    <!-- Single branch: info only -->
    <div v-else-if="branches.length === 1" class="branch-info">
      <div v-if="branches[0].address" class="branch-address">{{ branches[0].address }}</div>
      <div v-if="branches[0].workingHours" class="branch-hours">{{ branches[0].workingHours }}</div>
    </div>

    <!-- 2-4 branches: cards -->
    <div v-else-if="branches.length <= 4" class="branch-cards">
      <button
        v-for="branch in branches"
        :key="branch.id"
        type="button"
        class="branch-card"
        :class="{ selected: checkout.form.pickupBranchId === branch.id }"
        @click="selectBranch(branch.id)"
      >
        <span v-if="branch.address" class="branch-address">{{ branch.address }}</span>
        <span v-if="branch.workingHours" class="branch-hours">{{ branch.workingHours }}</span>
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
        <div v-if="selectedBranch.workingHours" class="branch-hours">{{ selectedBranch.workingHours }}</div>
      </div>
    </div>

    <div v-if="error" class="branch-error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCheckoutStore } from '~/stores/checkout'
import { FsHeading, FsSelect, FsSpinner } from '@fastio/public-ui'

type PickupBranch = {
  id: string
  name: string
  address: string | null
  workingHours: string | null
}

const checkout = useCheckoutStore()

const branches = ref<PickupBranch[]>([])
const loading = ref(true)
const error = ref('')

const branchOptions = computed(() =>
  branches.value.map((b) => {
    const parts = [b.address || b.name, b.workingHours].filter(Boolean)
    return { value: b.id, label: parts.join(' · ') }
  })
)

const selectedBranch = computed(() =>
  branches.value.find((b) => b.id === checkout.form.pickupBranchId) ?? null
)

function selectBranch(id: string) {
  checkout.form.pickupBranchId = id
}

onMounted(async () => {
  try {
    branches.value = await $fetch<PickupBranch[]>('/api/branches')

    // Auto-select if single branch
    if (branches.value.length === 1) {
      checkout.form.pickupBranchId = branches.value[0].id
    }
  } catch {
    error.value = 'Не удалось загрузить пункты самовывоза'
  } finally {
    loading.value = false
  }
})

function isValid(): boolean {
  if (branches.value.length === 0) {
    error.value = 'Нет доступных точек самовывоза'
    return false
  }
  if (!checkout.form.pickupBranchId) {
    error.value = 'Выберите пункт самовывоза'
    return false
  }
  error.value = ''
  return true
}

defineExpose({ isValid })
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
}

.branch-address {
  @include text-xs;
  color: var(--color-text-secondary);
}

.branch-hours {
  @include text-xs;
  color: var(--color-text-muted);
}

.branch-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.branch-error {
  @include text-xs;
  color: var(--color-error);
  margin-top: 8px;
}
</style>
