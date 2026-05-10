<template>
  <UiCard class="reservations-root">
    <div class="header">
      <UiText size="small" class="label">Брони на сегодня</UiText>
      <UiButton type="text" size="small" @click="$router.push('/reservations')">Все брони</UiButton>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 3" :key="i" class="group-item">
        <UiSkeleton height="20" />
        <UiSkeleton height="28" />
      </div>
    </div>

    <div v-else-if="hasReservations" class="grid">
      <div v-for="group in groups" :key="group.key" class="group-item">
        <UiText size="small" class="group-label">{{ group.label }}</UiText>
        <UiTitle size="h3" class="group-count">{{ group.count }}</UiTitle>
      </div>
    </div>

    <div v-else class="empty">
      <UiText size="small" class="empty-text">Нет броней на сегодня</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiCard, UiText, UiTitle, UiButton, UiSkeleton } from '@fastio/ui'
import type { Reservation } from '@fastio/shared'
import { todayInTz } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { reservationEvents } from '~/features/reservations'

type Props = {
  tenantId: string
  branchId: string | null
  timezone: string
}

const props = defineProps<Props>()

const api = useDatabase()
const reservations = ref<Reservation[]>([])
const loading = ref(true)

const fetchReservations = async () => {
  loading.value = true
  try {
    reservations.value = await api.reservations.list(props.tenantId, {
      date: todayInTz(props.timezone),
      branchId: props.branchId ?? undefined,
    })
  } finally {
    loading.value = false
  }
}

watch(() => [props.tenantId, props.branchId], fetchReservations, { immediate: true })

const offInsert = reservationEvents.onInsert(() => fetchReservations())
const offUpdate = reservationEvents.onUpdate(() => fetchReservations())
const offDelete = reservationEvents.onDelete(() => fetchReservations())

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

const countByStatus = computed(() => {
  const map: Record<string, number> = {}

  for (const r of reservations.value) {
    map[r.status] = (map[r.status] ?? 0) + 1
  }

  return map
})

const groups = computed(() => [
  { key: 'pending', label: 'Ожидают', count: countByStatus.value.pending ?? 0 },
  { key: 'confirmed', label: 'Подтверждены', count: countByStatus.value.confirmed ?? 0 },
  { key: 'seated', label: 'Сидят', count: countByStatus.value.seated ?? 0 },
])

const hasReservations = computed(() => groups.value.some((g) => g.count > 0))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.reservations-root {
  gap: var(--space-12);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  color: var(--color-text-hint);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-12);
}

.group-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.group-label {
  color: var(--color-text-secondary);
}

.group-count {
  color: var(--color-text);
}

.empty {
  padding: var(--space-16) 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-hint);
}
</style>
