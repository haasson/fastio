<template>
  <div class="request-content-root">
    <UiAlert v-if="editor.isClosedStatus.value" type="warning">
      Заявка обработана. Редактирование недоступно.
    </UiAlert>

    <div class="meta-row">
      <UiTag :type="APPOINTMENT_REQUEST_STATUS_TAG_TYPES[props.initialRequest.status]" size="small">
        {{ APPOINTMENT_REQUEST_STATUS_LABELS[props.initialRequest.status] }}
      </UiTag>
      <UiText size="small" class="muted">
        {{ formatCreatedAt }}{{ branchName ? ` • ${branchName}` : '' }}
      </UiText>
    </div>

    <UiSkeleton v-if="editor.loadingResources.value" :repeat="4" />

    <template v-else>
      <div class="content-grid">
        <!-- ─── Left: services ─────────────────────── -->
        <div class="col">
          <UiCard>
            <UiTitle size="h4" class="card-title">Запрошенные услуги</UiTitle>

            <div class="service-list">
              <UiCard
                v-for="(svc, i) in editor.state.services"
                :key="i"
                size="small"
                class="service-card"
              >
                <div class="service-info">
                  <UiText class="service-name">{{ svc.serviceName }}</UiText>
                  <UiText size="small" class="muted">
                    {{ formatMinutes(svc.durationMinutes) }} • {{ formatPrice(svc.price) }}
                  </UiText>
                </div>
                <UiSelect
                  v-if="!editor.isReadOnly.value"
                  v-model:value="svc.preferredResourceId"
                  :options="editor.resourceOptionsFor(svc.serviceId)"
                  clearable
                  placeholder="Без предпочтения"
                  size="small"
                  :disabled="editor.saving.value"
                />
                <UiText v-else size="small" class="muted">
                  {{
                    svc.preferredResourceId
                      ? editor.preferredResourceName(svc.preferredResourceId)
                      : 'Без предпочтения'
                  }}
                </UiText>
              </UiCard>
            </div>

            <div class="services-totals">
              <div class="total-row">
                <UiText size="small" class="total-label">Итого длительность</UiText>
                <UiText size="small">{{ formatMinutes(editor.totalDuration.value) }}</UiText>
              </div>
              <div class="total-row">
                <UiText size="small" class="total-label">Итого стоимость</UiText>
                <UiText size="small">{{ formatPrice(editor.totalPrice.value) }}</UiText>
              </div>
            </div>
          </UiCard>
        </div>

        <!-- ─── Right: client + processing ──────────── -->
        <div class="col">
          <AppointmentCustomerSection
            v-model:customer-name="editor.state.customerName"
            v-model:customer-phone="editor.state.customerPhone"
            v-model:customer-email="editor.state.customerEmail"
            v-model:notes="editor.state.notes"
            :disabled="editor.isReadOnly.value || editor.saving.value"
          />

          <UiCard v-if="props.initialRequest.status !== 'new'">
            <UiTitle size="h4" class="card-title">Обработка</UiTitle>
            <div class="processing-info">
              <div v-if="props.initialProcessor" class="total-row">
                <UiText size="small" class="total-label">Обработал</UiText>
                <UiText size="small">{{ props.initialProcessor.name }}</UiText>
              </div>
              <div v-if="props.initialRequest.processedAt" class="total-row">
                <UiText size="small" class="total-label">Когда</UiText>
                <UiText size="small">{{ formatProcessedAt }}</UiText>
              </div>
              <div v-if="props.initialConvertedGroup" class="total-row">
                <UiText size="small" class="total-label">Запись</UiText>
                <UiText size="small">
                  <NuxtLink :to="`/appointments/groups/${props.initialConvertedGroup.id}`" class="group-link">
                    Открыть запись клиента {{ props.initialConvertedGroup.customerName }}
                  </NuxtLink>
                </UiText>
              </div>
            </div>
          </UiCard>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiTitle, UiText, UiTag, UiAlert, UiSkeleton, UiSelect } from '@fastio/ui'
import AppointmentCustomerSection from '~/components/appointments/AppointmentCustomerSection.vue'
import type { AppointmentRequest, AppointmentGroup, Resource } from '@fastio/shared'
import {
  formatPrice, formatMinutes,
  APPOINTMENT_REQUEST_STATUS_LABELS,
  APPOINTMENT_REQUEST_STATUS_TAG_TYPES,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentRequestEditorState } from '~/composables/data/useAppointmentRequestEditorState'

type Props = {
  initialRequest: AppointmentRequest
  initialPreferredResources: Resource[]
  initialProcessor: { id: string; name: string } | null
  initialConvertedGroup: AppointmentGroup | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ saved: [] }>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const tz = computed(() => tenantStore.tenant?.timezone ?? 'UTC')

const editor = useAppointmentRequestEditorState({
  initialRequest: props.initialRequest,
  initialPreferredResources: props.initialPreferredResources,
})

const save = async () => {
  const ok = await editor.save()

  if (ok) emit('saved')
}

const branchName = computed(() => {
  if (!props.initialRequest.branchId) return null

  return branchStore.branches.find((b) => b.id === props.initialRequest.branchId)?.name ?? null
})

const formatCreatedAt = computed(() => new Intl.DateTimeFormat('ru', {
  timeZone: tz.value,
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(props.initialRequest.createdAt)))

const formatProcessedAt = computed(() => {
  if (!props.initialRequest.processedAt) return ''

  return new Intl.DateTimeFormat('ru', {
    timeZone: tz.value,
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(props.initialRequest.processedAt))
})

defineExpose({
  save,
  saving: editor.saving,
  dirty: editor.dirty,
  canSave: editor.canSave,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as mq;

.request-content-root {
  @include flex-col(var(--space-16));
}

.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq.mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.col {
  @include flex-col(var(--space-16));
}

.card-title {
  margin-bottom: var(--space-12);
}

.service-list {
  @include flex-col(var(--space-10));
  margin-bottom: var(--space-4);
}

.service-card {
  @include flex-col(var(--space-8));
}

.service-info {
  @include flex-col(var(--space-4));
}

.service-name {
  font-weight: var(--font-weight-medium);
}

.services-totals {
  @include flex-col(var(--space-8));
  margin-top: var(--space-12);
  padding-top: var(--space-12);
  border-top: 2px solid var(--color-border);
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-8);
}

.total-label {
  color: var(--color-text-secondary);
}

.processing-info {
  @include flex-col(var(--space-10));
}

.group-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.muted {
  color: var(--color-text-secondary);
}
</style>
