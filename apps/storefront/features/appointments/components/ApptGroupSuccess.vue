<template>
  <div class="success-root" data-testid="appointment-success">
    <div class="icon-wrap">
      <CalendarCheck :size="48" />
    </div>

    <FsHeading as="h3" class="title">Готово! Записали вас</FsHeading>

    <div class="appointments">
      <div
        v-for="appt in appointments"
        :key="appt.id"
        class="appt-row"
      >
        <div class="appt-service">{{ serviceNames[appt.serviceId] ?? appt.serviceId }}</div>
        <div class="appt-datetime">
          <span class="appt-date">{{ formatApptDate(appt.startsAt) }}</span>
          <span class="appt-time">{{ formatApptTime(appt.startsAt) }} – {{ formatApptTime(appt.endsAt) }}</span>
        </div>
      </div>
    </div>

    <FsButton variant="outline" as="a" href="/">На главную</FsButton>
  </div>
</template>

<script setup lang="ts">
import { CalendarCheck } from 'lucide-vue-next'
import { FsHeading, FsButton } from '@fastio/public-ui'

type AppointmentEntry = {
  id: string
  startsAt: string
  endsAt: string
  serviceId: string
}

const props = defineProps<{
  appointments: AppointmentEntry[]
  serviceNames: Record<string, string>
  timezone: string
}>()

const formatApptDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: props.timezone,
  })

const formatApptTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: props.timezone,
  })
</script>

<style scoped lang="scss">
.success-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 24px 0;
}

.icon-wrap {
  color: var(--primary);
}

.title {
  margin: 0;
}

.appointments {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  text-align: left;
}

.appt-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.appt-service {
  font-size: 14px;
  font-weight: 500;
}

.appt-datetime {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.appt-date {
  color: var(--color-text-secondary);
}

.appt-time {
  font-weight: 500;
}
</style>
