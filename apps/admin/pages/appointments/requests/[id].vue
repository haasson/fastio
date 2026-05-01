<template>
  <div class="request-page-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="router.push('/appointments/list')"
      >
        Назад
      </UiButton>
      <span class="page-title">{{ request ? `Заявка от ${request.customerName}` : 'Заявка' }}</span>
    </div>

    <UiSkeleton v-if="loading" :height="400" />

    <UiEmpty v-else-if="!request" icon="calendar" text="Заявка не найдена" />

    <template v-else>
      <AppointmentRequestContent
        ref="contentRef"
        :initial-request="request"
        :initial-preferred-resources="preferredResources"
        :initial-processor="processor"
        :initial-converted-group="convertedGroup"
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
          v-if="['new', 'in_progress'].includes(request.status) && canManage"
          type="primary"
          @click="onConvertToGroup"
        >Оформить запись</UiButton>

        <UiButton
          v-if="['new', 'in_progress'].includes(request.status) && canManage"
          :loading="declineLoading"
          :disabled="declineLoading"
          @click="handleDecline"
        >Отклонить</UiButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiSkeleton, UiEmpty, useMessage } from '@fastio/ui'
import type { AppointmentRequest, AppointmentGroup, Resource } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { useDatabase } from '~/composables/data/useDatabase'
import { useGate } from '~/composables/plan/useGate'
import { useAuthStore } from '~/stores/auth'
import { reportError } from '~/utils/reportError'
import AppointmentRequestContent from '~/components/appointments/AppointmentRequestContent.vue'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const gate = useGate()
const message = useMessage()
const authStore = useAuthStore()
const { confirm } = useConfirm()

const canManage = computed(() => gate.manageAppointments.value.enabled)
const isReadOnly = computed(() => {
  const s = request.value?.status

  return !canManage.value || s === 'converted' || s === 'declined'
})

const id = route.params.id as string
const loading = ref(true)
const request = ref<AppointmentRequest | null>(null)
const preferredResources = ref<Resource[]>([])
const processor = ref<{ id: string; name: string } | null>(null)
const convertedGroup = ref<AppointmentGroup | null>(null)

const contentRef = ref<InstanceType<typeof AppointmentRequestContent> | null>(null)

const loadData = async () => {
  const result = await api.appointmentRequests.loadRequestViewData(id)

  request.value = result.request
  preferredResources.value = result.preferredResources
  processor.value = result.processor
  convertedGroup.value = result.convertedGroup
}

onMounted(async () => {
  try {
    await loadData()
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить заявку')
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

// ─── Convert to group ─────────────────────────────────────────────────────────

const onConvertToGroup = () => {
  router.push(`/appointments/groups/new?fromRequest=${id}`)
}

// ─── Decline ──────────────────────────────────────────────────────────────────

const declineLoading = ref(false)

const handleDecline = async () => {
  const ok = await confirm({
    title: 'Отклонить заявку?',
    message: 'Заявка будет помечена как отклонённая.',
    confirmType: 'error',
    confirmText: 'Отклонить',
  })

  if (!ok) return

  const userId = authStore.user?.id

  if (!userId) return

  declineLoading.value = true
  try {
    await api.appointmentRequests.decline(id, userId)
    await loadData()
    message.success('Заявка отклонена')
  } catch (e) {
    reportError(e)
    message.error('Не удалось отклонить заявку')
  } finally {
    declineLoading.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.request-page-root {
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
</style>
