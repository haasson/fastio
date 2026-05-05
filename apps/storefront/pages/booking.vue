<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Бронирование">

        <div class="booking-wrap">
          <!-- Module disabled -->
          <SfEmptyState
            v-if="!reservationsEnabled"
            title="Бронирование недоступно"
            description="Онлайн-бронирование столов пока недоступно"
          >
            <CalendarCheck :size="48" />
          </SfEmptyState>

          <!-- Success screen -->
          <BookingSuccess
            v-else-if="result"
            :status="result.status"
            :date="form.date"
            :time="form.time"
            :guest-count="form.guestCount"
            :show-link-warning="wasAuthenticated && !result.linkedToAccount"
          />

          <!-- Booking form -->
          <template v-else>
            <div class="steps">
              <span
                v-for="n in 3"
                :key="n"
                class="step-dot"
                :class="{ 'step-dot--active': step === n, 'step-dot--done': step > n }"
              />
            </div>

            <FsHeading as="h5" class="step-title">{{ STEP_TITLES[step] }}</FsHeading>

            <FsAlert v-if="error" type="error" class="step-error">{{ error }}</FsAlert>

            <BookingStepParams
              v-if="step === 1"
              v-model:form="form"
              :max-guests="settings?.maxGuests ?? 20"
              :max-advance-days="settings?.maxAdvanceDays ?? 30"
              :branches="branches ?? []"
              :schedule="currentSchedule"
              :timezone="tenant?.timezone ?? DEFAULT_TIMEZONE"
              @next="goToStep2"
            />

            <BookingStepSlots
              v-else-if="step === 2"
              v-model:form="form"
              :slots="slots"
              :loading="loading"
              :working-hours="workingHoursForDate"
              @next="step = 3"
              @back="step = 1"
            />

            <BookingStepContact
              v-else-if="step === 3"
              v-model:form="form"
              :loading="loading"
              @submit="handleSubmit"
              @back="step = 2"
            />
          </template>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncData, useNuxtData, useRequestFetch } from 'nuxt/app'
import type { BranchPublic, WorkingHours, WorkingHoursSchedule, ReservationSettings, Tenant } from '@fastio/shared'
import { getScheduleForDate, DEFAULT_TIMEZONE } from '@fastio/shared'
import { CalendarCheck } from 'lucide-vue-next'
import { FsSection, FsHeading, FsAlert } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import BookingStepParams from '~/components/booking/BookingStepParams.vue'
import BookingStepSlots from '~/components/booking/BookingStepSlots.vue'
import BookingStepContact from '~/components/booking/BookingStepContact.vue'
import BookingSuccess from '~/components/booking/BookingSuccess.vue'

import useBooking from '~/composables/useBooking'
import useLegalCompliance from '~/composables/useLegalCompliance'

type BookingBranch = BranchPublic

const rfetch = useRequestFetch()
const { step, form, slots, loading, result, wasAuthenticated, error, fetchSlots, submit } = useBooking()

const { data: tenant } = useNuxtData<Tenant>('tenant')

const { legalInfoComplete } = useLegalCompliance()
const reservationsEnabled = computed(() => tenant.value?.modules?.reservations === true && legalInfoComplete.value)

const { data: branches } = await useAsyncData<BookingBranch[]>(
  'booking-branches',
  async () => {
    if (!reservationsEnabled.value) return []
    try {
      const data = await rfetch<BookingBranch[]>('/api/branches')
      if (data.length === 1) form.branchId = data[0].id
      return data
    } catch {
      return []
    }
  },
  { default: () => [] },
)

const { data: settings } = await useAsyncData<ReservationSettings | null>(
  'reservation-settings',
  async () => {
    if (!reservationsEnabled.value) return null
    try {
      return await rfetch<ReservationSettings>('/api/reservations/settings')
    } catch {
      return null
    }
  },
  { default: () => null },
)

const STEP_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Выберите дату и количество гостей',
  2: 'Выберите время',
  3: 'Ваши контакты',
}

const currentSchedule = computed<WorkingHoursSchedule | null>(() => {
  const selectedBranch = branches.value?.find((b) => b.id === form.branchId)
  return selectedBranch?.workingHoursSchedule ?? tenant.value?.workingHoursSchedule ?? null
})

const workingHoursForDate = computed<WorkingHours | null>(() => {
  const schedule = currentSchedule.value
  if (!schedule || !form.date) return null
  return getScheduleForDate(schedule, form.date)
})

const goToStep2 = async () => {
  step.value = 2
  await fetchSlots()
}

const handleSubmit = async () => {
  await submit()
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.booking-wrap {
  max-width: 480px;
  margin: 0 auto;
}

.steps {
  @include flex-row(8px);
  justify-content: center;
  margin-bottom: 20px;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border);
  transition: background 0.2s, width 0.2s, border-radius 0.2s;

  &--active {
    background: var(--primary);
    width: 24px;
    border-radius: 4px;
  }

  &--done {
    background: var(--primary);
    opacity: 0.5;
  }
}

.step-title {
  text-align: center;
  margin-bottom: 16px;
}

.step-error {
  margin-bottom: 12px;
}
</style>
