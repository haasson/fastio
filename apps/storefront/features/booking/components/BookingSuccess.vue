<template>
  <div class="success-root" data-testid="booking-success">
    <div class="icon-wrap">
      <CalendarCheck :size="48" />
    </div>

    <template v-if="status === 'confirmed'">
      <FsHeading as="h3" class="title">Стол забронирован!</FsHeading>
      <p class="desc">Ждём вас {{ formattedDate }} в {{ time }}</p>
    </template>

    <template v-else>
      <FsHeading as="h3" class="title">Заявка принята</FsHeading>
      <p class="desc">Мы свяжемся с вами для подтверждения брони</p>
    </template>

    <p v-if="showLinkWarning" class="link-warning">
      Бронь не привязана к вашему аккаунту — возможно, сессия истекла. Войдите снова и создайте новую бронь.
    </p>

    <div class="details">
      <div class="detail-row">
        <span class="label">Дата</span>
        <span class="value">{{ formattedDate }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Время</span>
        <span class="value">{{ time }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Гостей</span>
        <span class="value">{{ guestCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CalendarCheck } from 'lucide-vue-next'
import { FsHeading } from '@fastio/public-ui'
import type { ReservationStatus } from '@fastio/shared'
import { dateStrToTs, formatDateLong } from '@fastio/shared'

const props = defineProps<{
  status: ReservationStatus
  date: string
  time: string
  guestCount: number
  showLinkWarning?: boolean
}>()

const formattedDate = computed(() => props.date ? formatDateLong(dateStrToTs(props.date)) : '')
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

.desc {
  color: var(--color-text-secondary);
  font-size: 15px;
  margin: 0;
}

.link-warning {
  font-size: 13px;
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-radius: var(--radius-card);
  padding: 10px 14px;
  margin: 0;
  text-align: left;
}

.details {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.label {
  color: var(--color-text-secondary);
}

.value {
  font-weight: 500;
}
</style>
