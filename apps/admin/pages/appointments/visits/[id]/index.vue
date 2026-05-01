<template>
  <div class="visit-page-root">
    <div class="page-header">
      <div class="top-row">
        <UiButton
          type="default"
          size="small"
          icon="chevronLeft"
          @click="router.push('/appointments/list')"
        >
          Назад
        </UiButton>

        <div v-if="visit" class="header-actions">
          <UiButton
            v-if="!isReadOnly"
            type="primary"
            size="small"
            :loading="contentRef?.saving"
            :disabled="!contentRef?.canSave || (!isRequestVisit && !contentRef?.dirty)"
            @click="contentRef?.save()"
          >Сохранить изменения</UiButton>

          <UiButton
            v-if="canManage && hasPending"
            type="default"
            size="small"
            :loading="confirmLoading"
            :disabled="busy"
            @click="handleConfirm"
          >Подтвердить визит</UiButton>

          <UiButton
            v-if="canManage && hasActive && !hasPending"
            size="small"
            type="default"
            :loading="doneLoading"
            :disabled="busy"
            @click="handleDoneAll"
          >Завершить визит</UiButton>

          <UiButton
            v-if="canManage && canCancel"
            size="small"
            :loading="cancelLoading"
            :disabled="busy"
            @click="openCancelModal"
          >Отменить визит</UiButton>

          <UiButton
            v-if="canManage && hasActive"
            size="small"
            type="default"
            :disabled="busy"
            @click="splitOpen = true"
          >Разделить</UiButton>
        </div>
      </div>
    </div>

    <UiSkeleton v-if="loading" :height="400" />

    <UiEmpty v-else-if="!visit" icon="calendar" text="Визит не найден" />

    <template v-else>
      <VisitContent
        ref="contentRef"
        mode="edit"
        :initial-visit="visit"
        :initial-appointments="appointments"
        :initial-events="events"
        @saved="onSaved"
      />

      <UiCard v-if="canManage && openEndedActive.length > 0" class="extend-card">
        <UiTitle size="h4" class="card-title">Продление (открытое окончание)</UiTitle>
        <div
          v-for="appt in openEndedActive"
          :key="appt.id"
          class="extend-row"
        >
          <div class="extend-info">
            <UiText>{{ appt.serviceName }}</UiText>
            <UiText size="small" class="muted">
              до {{ formatApptEnd(appt) }}
            </UiText>
          </div>
          <div class="extend-actions">
            <UiButton
              size="small"
              type="default"
              :loading="extendLoadingId === appt.id"
              :disabled="!!extendLoadingId || !!closeLoadingId"
              @click="handleExtend(appt.id, 30)"
            >+30 мин</UiButton>
            <UiButton
              size="small"
              type="default"
              :loading="extendLoadingId === appt.id"
              :disabled="!!extendLoadingId || !!closeLoadingId"
              @click="handleExtend(appt.id, 60)"
            >+60 мин</UiButton>
            <UiButton
              size="small"
              :loading="closeLoadingId === appt.id"
              :disabled="!!extendLoadingId || !!closeLoadingId"
              @click="handleCloseNow(appt.id)"
            >Закрыть сейчас</UiButton>
          </div>
        </div>
      </UiCard>

      <SplitVisitModal
        v-if="canManage && visit && hasActive"
        v-model="splitOpen"
        :visit="visit"
        :appointments="appointments"
        @done="onSaved"
      />
    </template>

    <CancelGroupModal
      v-model="cancelModal.show"
      v-model:reason="cancelModal.reason"
      :loading="cancelModal.loading"
      :on-confirm="submitCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiSkeleton, UiEmpty, UiCard, UiTitle, UiText, useMessage } from '@fastio/ui'
import type { Appointment, AppointmentEvent, Visit } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useGate } from '~/composables/plan/useGate'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { reportError } from '~/utils/reportError'
import VisitContent from '~/components/appointments/VisitContent.vue'
import CancelGroupModal from '~/components/appointments/CancelGroupModal.vue'
import SplitVisitModal from '~/components/appointments/SplitVisitModal.vue'
import { useVisitAggregate } from '~/composables/data/useVisitAggregate'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const gate = useGate()
const message = useMessage()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const canManage = computed(() => gate.manageAppointments.value.enabled)
const isReadOnly = computed(() => !canManage.value)

const id = route.params.id as string
const loading = ref(true)
const visit = ref<Visit | null>(null)
const appointments = ref<Appointment[]>([])
const events = ref<AppointmentEvent[]>([])

const contentRef = ref<InstanceType<typeof VisitContent> | null>(null)

const splitOpen = ref(false)

// Все агрегатные флаги (isRequest/hasPending/canCancel/...) — через
// общий composable, чтобы не дублировать ту же логику в других местах.
const {
  isRequestVisit, hasPending, hasActive, canCancel,
} = useVisitAggregate(visit, appointments)

const loadData = async () => {
  const result = await api.visits.loadVisitViewData(id)

  visit.value = result.visit
  appointments.value = result.appointments
  events.value = result.events
}

onMounted(async () => {
  try {
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить визит')
  } finally {
    loading.value = false
  }
})

const onSaved = async () => {
  try {
    await loadData()
  } catch (e) {
    reportError(e)
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

const confirmLoading = ref(false)
const cancelLoading = ref(false)
const doneLoading = ref(false)
const busy = computed(() => confirmLoading.value || cancelLoading.value || doneLoading.value)

const cancelModal = reactive({
  show: false,
  reason: '',
  loading: false,
})

const handleConfirm = async () => {
  const userId = authStore.user?.id

  if (!userId) return

  const needsMaster = appointments.value
    .filter((a) => a.status === 'new')
    .filter((a) => !a.resourceId || a.resourceAssignedBy === 'auto')

  if (needsMaster.length > 0) {
    const names = needsMaster.map((a) => a.serviceName).join(', ')

    message.warning(`Сначала назначьте мастера для услуг: ${names}`)

    return
  }

  if (contentRef.value?.hasInvalidSlots) {
    message.warning('Сначала исправьте услуги с подсвеченными красным слотами — они недоступны на эту дату')

    return
  }

  confirmLoading.value = true
  try {
    await api.visits.confirm(id, userId)
    message.success('Визит подтверждён')
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось подтвердить визит')
  } finally {
    confirmLoading.value = false
  }
}

const openCancelModal = () => {
  cancelModal.reason = ''
  cancelModal.loading = false
  cancelModal.show = true
}

const handleDoneAll = async () => {
  doneLoading.value = true
  try {
    const toFinish = appointments.value.filter((a) => a.status === 'confirmed')

    await Promise.all(toFinish.map((a) => api.appointments.markDone(a.id)))
    message.success('Визит завершён')
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось завершить визит')
  } finally {
    doneLoading.value = false
  }
}

const submitCancel = async (): Promise<boolean | void> => {
  cancelModal.loading = true
  try {
    // Для request-визита cancelAll просто переведёт его в cancelled
    // (бывшая операция «Отклонить заявку»).
    await api.visits.cancelAll(id, cancelModal.reason || null)
    message.success('Визит отменён')
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось отменить визит')
    cancelModal.loading = false

    return false
  }
}

// ─── Extend / CloseNow (open_ended) ──────────────────────────────────────────

const openEndedActive = computed(() => appointments.value.filter(
  (a) => a.bookingMode === 'open_ended' && (a.status === 'confirmed' || a.status === 'new'),
))

const extendLoadingId = ref<string | null>(null)
const closeLoadingId = ref<string | null>(null)

const tz = computed(() => tenantStore.tenant?.timezone ?? 'UTC')

const formatApptEnd = (appt: Appointment): string => {
  const iso = appt.actualEndsAt ?? appt.endsAt

  return new Intl.DateTimeFormat('ru', {
    timeZone: tz.value,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

const formatOverlapTime = (isoOrEmpty: string): string => {
  if (!isoOrEmpty) return 'ближайшее время'
  try {
    return new Intl.DateTimeFormat('ru', {
      timeZone: tz.value,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(isoOrEmpty))
  } catch {
    return isoOrEmpty
  }
}

const handleExtend = async (apptId: string, minutes: number) => {
  extendLoadingId.value = apptId
  try {
    await api.appointments.extend(apptId, minutes)
    message.success(`Запись продлена на ${minutes} минут`)
    await loadData()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    if (msg.startsWith('OVERLAP:')) {
      const nextTime = formatOverlapTime(msg.slice('OVERLAP:'.length))

      message.error(`Нельзя продлить — следующий клиент в ${nextTime}`)
    } else {
      reportError(e)
      message.error('Не удалось продлить запись')
    }
  } finally {
    extendLoadingId.value = null
  }
}

const handleCloseNow = async (apptId: string) => {
  closeLoadingId.value = apptId
  try {
    await api.appointments.closeNow(apptId)
    message.success('Запись закрыта')
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось закрыть запись')
  } finally {
    closeLoadingId.value = null
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.visit-page-root {
  @include flex-col(var(--space-20));
}

.page-header {
  @include flex-col(var(--space-8));
}

.extend-card {
  .card-title {
    margin-bottom: var(--space-12);
  }
}

.extend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  flex-wrap: wrap;

  & + & {
    margin-top: var(--space-12);
    padding-top: var(--space-12);
    border-top: 1px solid var(--color-border);
  }
}

.extend-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.extend-actions {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.muted {
  color: var(--color-text-secondary);
}

.top-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.header-actions {
  @include flex-row(var(--space-8));
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
  flex-wrap: wrap;
}
</style>
