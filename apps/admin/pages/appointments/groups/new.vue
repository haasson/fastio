<template>
  <div class="group-new-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="router.push('/appointments/list')"
      >
        Назад
      </UiButton>
      <span class="page-title">{{ pageTitle }}</span>
    </div>

    <UiSkeleton v-if="loading" :repeat="6" />

    <template v-else>
      <AppointmentGroupContent
        ref="contentRef"
        mode="create"
        :initial-request="request"
      />

      <div class="actions">
        <UiButton
          type="primary"
          :loading="contentRef?.saving"
          :disabled="!contentRef?.canSave || !contentRef?.dirty"
          @click="contentRef?.save()"
        >Сохранить</UiButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiSkeleton, useMessage } from '@fastio/ui'
import type { AppointmentRequest } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'
import AppointmentGroupContent from '~/components/appointments/AppointmentGroupContent.vue'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const message = useMessage()

const loading = ref(false)
const request = ref<AppointmentRequest | null>(null)
const contentRef = ref<InstanceType<typeof AppointmentGroupContent> | null>(null)

const fromRequestId = (route.query.fromRequest as string | undefined) ?? null

const pageTitle = computed(() => request.value ? `Оформление заявки от ${request.value.customerName}` : 'Новая запись')

onMounted(async () => {
  if (!fromRequestId) return

  loading.value = true
  try {
    const result = await api.appointmentRequests.loadRequestViewData(fromRequestId)

    request.value = result.request
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить заявку')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.group-new-root {
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
  justify-content: flex-end;
}
</style>
