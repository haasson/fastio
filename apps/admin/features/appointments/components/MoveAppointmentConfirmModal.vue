<template>
  <UiModal
    v-model="open"
    title="Перенести запись?"
    :loading="loading"
    :on-confirm="onConfirm"
    :actions="[
      { text: 'Отмена', actionType: 'decline' },
      { text: 'Подтвердить', actionType: 'confirm', type: 'primary' },
    ]"
  >
    <div v-if="pending" class="rows">
      <div class="row">
        <UiText size="small" class="label">Клиент</UiText>
        <UiText weight="medium">
          {{ pending.appt.customerName }} — {{ pending.appt.serviceName }}
        </UiText>
      </div>

      <div class="row">
        <UiText size="small" class="label">Текущее</UiText>
        <UiText>
          {{ fromResourceName }} · {{ formatTime(pending.appt.startsAt) }}–{{ formatTime(pending.appt.actualEndsAt ?? pending.appt.endsAt) }}
        </UiText>
      </div>

      <div class="row">
        <UiText size="small" class="label">Новое</UiText>
        <UiText>
          <span :class="{ changed: resourceChanged }">{{ toResourceName }}</span>
          ·
          <span :class="{ changed: timeChanged }">
            {{ formatTime(pending.newStartIso) }}–{{ formatTime(pending.newActualEndIso ?? pending.newEndIso) }}
          </span>
        </UiText>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiModal, UiText } from '@fastio/ui'
import type { Appointment, Resource } from '@fastio/shared'

export type MovePending = {
  appt: Appointment
  newResourceId: string
  newStartIso: string
  newEndIso: string
  newActualEndIso: string | null
}

const props = defineProps<{
  pending: MovePending | null
  resources: Resource[]
  tz: string
  loading: boolean
  onConfirm: () => Promise<boolean | void>
}>()

const open = defineModel<boolean>({ required: true })

const fromResourceName = computed(() => {
  if (!props.pending) return ''

  return props.resources.find((r) => r.id === props.pending!.appt.resourceId)?.name ?? '—'
})

const toResourceName = computed(() => {
  if (!props.pending) return ''

  return props.resources.find((r) => r.id === props.pending!.newResourceId)?.name ?? '—'
})

const resourceChanged = computed(() => props.pending?.appt.resourceId !== props.pending?.newResourceId)

// Сравнения по startsAt достаточно: drag сдвигает start и end на одинаковый
// dyMin, длительность услуги не меняется. Resize карточки не предусмотрен.
const timeChanged = computed(() => props.pending?.appt.startsAt !== props.pending?.newStartIso)

const formatTime = (iso: string): string => new Intl.DateTimeFormat('en-GB', {
  timeZone: props.tz,
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.rows {
  @include flex-col(var(--space-12));
}

.row {
  @include flex-col(var(--space-4));
}

.label {
  color: var(--color-text-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: var(--font-size-xs);
}

.changed {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
