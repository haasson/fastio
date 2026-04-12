<template>
  <div class="picker-root">
    <div v-if="freeTables.length" class="section">
      <UiText size="tiny" color="secondary">Доступны (вместимость ≥ {{ guestCount }})</UiText>
      <div class="grid">
        <UiChip
          v-for="t in freeTables"
          :key="t.id"
          type="success"
          :sub="t.capacity ? `до ${t.capacity} чел.` : undefined"
          :selected="modelValue === t.id"
          @click="$emit('update:modelValue', t.id)"
        >{{ t.name }}</UiChip>
      </div>
    </div>

    <div v-if="bookedTables.length" class="section">
      <UiText size="tiny" color="secondary">{{ bookedSectionTitle }}</UiText>
      <div class="grid">
        <UiChip
          v-for="item in bookedTables"
          :key="item.table.id"
          type="warning"
          :sub="item.sub"
          :selected="modelValue === item.table.id"
          @click="$emit('update:modelValue', item.table.id)"
        >{{ item.table.name }}</UiChip>
      </div>
    </div>

    <UiAlert v-if="selectedTableIsBooked" type="warning">
      Внимание: {{ selectedTableWarning }}
    </UiAlert>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiAlert, UiChip, UiText } from '@fastio/ui'
import type { Reservation, Table } from '@fastio/shared'
import { todayInTz, dateStrToTs, formatDateMonthDay } from '@fastio/shared'

const props = defineProps<{
  modelValue: string | null
  tables: Table[]
  /** Брони на выбранную дату (без текущей брони, только активные статусы) */
  dayReservations: Reservation[]
  guestCount: number
  reservedDate: string
  timezone: string
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const isToday = computed(() => props.reservedDate === todayInTz(props.timezone))

// tableId → список времён занятости
const tableBookings = computed((): Map<string, string[]> => {
  const map = new Map<string, string[]>()

  for (const r of props.dayReservations) {
    if (!r.tableId) continue
    if (!map.has(r.tableId)) map.set(r.tableId, [])
    map.get(r.tableId)!.push(r.reservedTime)
  }

  return map
})

const freeTables = computed(() => props.tables.filter((t) => !(isToday.value && t.isOpen)
  && !tableBookings.value.has(t.id)
  && (t.capacity === null || t.capacity >= props.guestCount),
),
)

const bookedTables = computed(() => props.tables
  .filter((t) => (isToday.value && t.isOpen) || tableBookings.value.has(t.id))
  .map((t) => {
    const times = tableBookings.value.get(t.id) ?? []
    const parts = [
      isToday.value && t.isOpen ? 'открыт сейчас' : '',
      ...times,
    ].filter(Boolean)

    return { table: t, sub: parts.join(', ') }
  }),
)

const bookedSectionTitle = computed(() => {
  if (isToday.value) return 'Заняты сегодня'

  return `Заняты ${formatDateMonthDay(dateStrToTs(props.reservedDate))}`
})

const selectedTableIsBooked = computed(() => {
  if (!props.modelValue) return false
  const t = props.tables.find((x) => x.id === props.modelValue)

  return (isToday.value && !!t?.isOpen) || tableBookings.value.has(props.modelValue)
})

const selectedTableWarning = computed(() => {
  if (!props.modelValue) return ''
  const t = props.tables.find((x) => x.id === props.modelValue)
  const parts = [
    isToday.value && t?.isOpen ? 'стол сейчас открыт' : '',
    ...(tableBookings.value.get(props.modelValue) ?? []).map((time) => `бронь в ${time}`),
  ].filter(Boolean)

  return parts.join(', ')
})
</script>

<style scoped lang="scss">
.picker-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
