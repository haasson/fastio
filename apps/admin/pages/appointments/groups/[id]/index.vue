<template>
  <div class="group-page-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="router.push('/appointments/list')"
      >
        Назад
      </UiButton>
      <span class="page-title">{{ group ? `Запись клиента ${group.customerName}` : 'Запись' }}</span>
    </div>

    <UiSkeleton v-if="loading" :height="400" />

    <UiEmpty v-else-if="!group" icon="calendar" text="Запись не найдена" />

    <template v-else>
      <UiAlert v-if="fromRequestId" type="success">
        Запись создана из заявки.
        <NuxtLink :to="`/appointments/requests/${fromRequestId}`" class="request-link">Открыть заявку</NuxtLink>
      </UiAlert>

      <AppointmentGroupContent
        ref="contentRef"
        mode="edit"
        :initial-group="group"
        :initial-appointments="appointments"
        :initial-events="events"
        @saved="onSaved"
      />

      <div class="actions">
        <UiButton
          v-if="!isReadOnly"
          type="primary"
          :loading="contentRef?.saving"
          :disabled="!contentRef?.dirty || !contentRef?.canSave"
          @click="contentRef?.save()"
        >Сохранить</UiButton>

        <UiButton
          v-if="group.status === 'new' && canManage"
          type="default"
          :loading="confirmLoading"
          :disabled="confirmLoading || cancelLoading"
          @click="handleConfirm"
        >Подтвердить группу</UiButton>

        <UiButton
          v-if="['new', 'confirmed', 'partially_cancelled'].includes(group.status) && canManage"
          :loading="cancelLoading"
          :disabled="confirmLoading || cancelLoading"
          @click="openCancelModal"
        >Отменить группу</UiButton>
      </div>
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
import { UiButton, UiSkeleton, UiEmpty, UiAlert, useMessage } from '@fastio/ui'
import type { Appointment, AppointmentEvent, AppointmentGroup } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useGate } from '~/composables/plan/useGate'
import { useAuthStore } from '~/stores/auth'
import { reportError } from '~/utils/reportError'
import AppointmentGroupContent from '~/components/appointments/AppointmentGroupContent.vue'
import CancelGroupModal from '~/components/appointments/CancelGroupModal.vue'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const gate = useGate()
const message = useMessage()
const authStore = useAuthStore()

const canManage = computed(() => gate.manageAppointments.value.enabled)
const isReadOnly = computed(() => {
  const s = group.value?.status

  return !canManage.value || s === 'cancelled' || s === 'done'
})

const fromRequestId = computed(
  () => group.value?.requestId ?? (route.query.fromRequest as string | undefined) ?? null,
)

const id = route.params.id as string
const loading = ref(true)
const group = ref<AppointmentGroup | null>(null)
const appointments = ref<Appointment[]>([])
const events = ref<AppointmentEvent[]>([])

const contentRef = ref<InstanceType<typeof AppointmentGroupContent> | null>(null)

const loadData = async () => {
  const result = await api.appointmentGroups.loadGroupViewData(id)

  group.value = result.group
  appointments.value = result.appointments
  events.value = result.events
}

onMounted(async () => {
  try {
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить запись')
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

const cancelModal = reactive({
  show: false,
  reason: '',
  loading: false,
})

const handleConfirm = async () => {
  const userId = authStore.user?.id

  if (!userId) return

  confirmLoading.value = true
  try {
    await api.appointmentGroups.confirm(id, userId)
    await loadData()
    message.success('Группа подтверждена')
  } catch (e) {
    reportError(e)
    message.error('Не удалось подтвердить группу')
  } finally {
    confirmLoading.value = false
  }
}

const openCancelModal = () => {
  cancelModal.reason = ''
  cancelModal.loading = false
  cancelModal.show = true
}

const submitCancel = async (): Promise<boolean | void> => {
  cancelModal.loading = true
  try {
    await api.appointmentGroups.cancelAll(id, cancelModal.reason || null)
    await loadData()
    message.success('Группа отменена')
  } catch (e) {
    reportError(e)
    message.error('Не удалось отменить группу')
    cancelModal.loading = false

    return false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.group-page-root {
  @include flex-col(var(--space-20));
}

.page-header {
  @include flex-row(var(--space-12));
  align-items: center;
}

.page-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.request-link {
  color: inherit;
  font-weight: var(--font-weight-medium);
  margin-left: var(--space-4);

  &:hover {
    text-decoration: underline;
  }
}
</style>
