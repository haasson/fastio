<template>
  <div class="appt-page-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="goBack"
      >
        Назад
      </UiButton>

      <UiTag
        v-if="appt && inProgress"
        size="small"
        type="success"
        round
      >
        Идёт сейчас
      </UiTag>

      <div v-if="appt && canManage" class="actions">
        <UiButton
          v-if="appt.status === 'confirmed'"
          type="primary"
          size="small"
          :loading="finishing"
          @click="onFinish"
        >Завершить услугу</UiButton>
      </div>
    </div>

    <UiSkeleton v-if="loading" :height="240" />

    <UiEmpty v-else-if="!appt" icon="calendar" text="Запись не найдена" />

    <UiCard v-else>
      <div class="rows">
        <div class="row">
          <UiText size="small" class="label">Время</UiText>
          <UiText weight="medium">{{ timeRange }}</UiText>
        </div>

        <div class="row">
          <UiText size="small" class="label">Услуга</UiText>
          <UiText weight="medium">{{ appt.serviceName }}</UiText>
        </div>

        <div class="row">
          <UiText size="small" class="label">Клиент</UiText>
          <UiText weight="medium">{{ appt.customerName || '—' }}</UiText>
        </div>

        <div v-if="appt.notes" class="row">
          <UiText size="small" class="label">Комментарий</UiText>
          <UiText>{{ appt.notes }}</UiText>
        </div>

        <div class="row">
          <UiText size="small" class="label">Статус</UiText>
          <UiTag size="small" :type="statusTagType">{{ statusLabel }}</UiTag>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiCard, UiEmpty, UiSkeleton, UiTag, UiText, useMessage } from '@fastio/ui'
import type { Appointment } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useGate } from '~/composables/plan/useGate'
import { useAppointmentViewScope } from '~/composables/services/useAppointmentViewScope'
import { useTenantStore } from '~/stores/tenant'
import { reportError } from '~/utils/reportError'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const gate = useGate()
const message = useMessage()
const tenantStore = useTenantStore()
const { memberships, currentTenantId } = storeToRefs(tenantStore)
const { ownResourcesOnly } = useAppointmentViewScope()

const id = route.params.id as string
const canManage = computed(() => gate.manageAppointments.value.enabled)

const loading = ref(true)
const appt = ref<Appointment | null>(null)
const finishing = ref(false)

// Эта страница — entry-point только для view_own мастеров с таймлайна.
// Возврат всегда на таймлайн.
const goBack = () => router.push('/appointments/timeline')

const tz = computed(() => tenantStore.tenant.timezone ?? 'Europe/Moscow')

const formatTime = (iso: string): string => new Intl.DateTimeFormat('en-GB', {
  timeZone: tz.value,
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso))

const timeRange = computed(() => {
  const a = appt.value

  if (!a) return ''
  const start = formatTime(a.startsAt)
  const end = formatTime(a.actualEndsAt ?? a.endsAt)

  return `${start}–${end}`
})

const STATUS_LABELS: Record<string, string> = {
  new: 'Ожидает',
  confirmed: 'Подтверждена',
  done: 'Завершена',
  cancelled: 'Отменена',
}

const statusLabel = computed(() => appt.value ? (STATUS_LABELS[appt.value.status] ?? appt.value.status) : '')

const statusTagType = computed(() => {
  switch (appt.value?.status) {
    case 'confirmed': return 'success'
    case 'done': return 'default'
    case 'cancelled': return 'error'
    default: return 'warning'
  }
})

// Таймер now-обновления только пока услуга confirmed — done/cancelled тикать
// смысла нет. watchEffect пересоздаёт таймер если статус сменился (mark-done).
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null

const isConfirmed = computed(() => appt.value?.status === 'confirmed')

watchEffect(() => {
  if (isConfirmed.value && !nowTimer) {
    nowTimer = setInterval(() => {
      now.value = Date.now()
    }, 60_000)
  } else if (!isConfirmed.value && nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})

const inProgress = computed(() => {
  const a = appt.value

  if (!a || a.status !== 'confirmed') return false
  const start = new Date(a.startsAt).getTime()
  const end = new Date(a.actualEndsAt ?? a.endsAt).getTime()

  return start <= now.value && now.value < end
})

const load = async () => {
  loading.value = true
  try {
    const data = await api.appointments.getById(id)

    appt.value = data

    if (!data) return

    // view_own — пускаем только если запись на собственном ресурсе.
    // Без этого мастер мог бы открыть чужую услугу прямой ссылкой.
    // Лёгкий запрос только member_id ресурса вместо тягания всего списка.
    if (ownResourcesOnly.value) {
      const tid = currentTenantId.value
      const myMemberId = tid ? memberships.value.find((m) => m.tenantId === tid)?.id ?? null : null
      const resourceMemberId = data.resourceId
        ? await api.resources.getMemberId(data.resourceId)
        : null

      if (myMemberId === null || resourceMemberId !== myMemberId) {
        message.warning('У вас нет доступа к этой записи')
        router.replace('/appointments/timeline')
      }
    }
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить запись')
  } finally {
    loading.value = false
  }
}

const onFinish = async () => {
  if (!appt.value) return
  finishing.value = true
  try {
    await api.appointments.markDone(appt.value.id)
    appt.value = { ...appt.value, status: 'done' }
    message.success('Услуга завершена')
  } catch (e) {
    reportError(e)
    message.error('Не удалось завершить услугу')
  } finally {
    finishing.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.appt-page-root {
  @include flex-col(var(--space-16));
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.actions {
  margin-left: auto;
  display: flex;
  gap: var(--space-8);
}

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
</style>
