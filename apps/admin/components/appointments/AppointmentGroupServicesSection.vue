<template>
  <UiCard>
    <UiTitle size="h4" class="card-title">Услуги</UiTitle>

    <UiEmpty
      v-if="services.length === 0"
      icon="calendar"
      text="Услуги не добавлены"
    />

    <div v-else class="service-list">
      <UiCard
        v-for="svc in services"
        :key="svc._key"
        size="small"
        class="service-card"
        :class="{ 'service-card--cancelled': svc.pendingRemove }"
      >
        <div class="service-row">
          <div class="service-main">
            <UiText class="service-name">{{ svc.serviceName }}</UiText>
            <UiText size="small" class="service-meta">
              {{ formatMinutes(svc.durationMinutes) }} • {{ formatPrice(svc.price) }}
            </UiText>
            <UiText v-if="isReadOnly && svc.appointmentId" size="small" class="muted">
              {{ appointmentTimeRange(svc.appointmentId) }}
            </UiText>
            <UiTag v-if="svc.pendingRemove" size="small" type="error">Будет удалена</UiTag>
          </div>
          <template v-if="!isReadOnly">
            <UiButton
              v-if="!svc.pendingRemove"
              type="text"
              size="small"
              icon="close"
              :disabled="saving"
              @click="emit('remove', svc._key)"
            />
            <UiButton
              v-else
              type="text"
              size="small"
              :disabled="saving"
              @click="emit('restore', svc._key)"
            >Вернуть</UiButton>
          </template>
        </div>

        <UiSelect
          v-if="!isReadOnly"
          v-model:value="svc.preferredResourceId"
          :options="resourceOptionsFor(svc.serviceId)"
          clearable
          placeholder="Любой исполнитель"
          size="small"
          :disabled="svc.pendingRemove || saving"
        />
        <UiText v-else size="small" class="muted">
          {{ resourceDisplayName(svc) }}
        </UiText>
      </UiCard>
    </div>

    <UiButton
      v-if="!isReadOnly"
      type="default"
      size="small"
      icon="plus"
      class="add-service-btn"
      :disabled="saving"
      @click="addOpen = true"
    >Добавить услугу</UiButton>

    <AddServiceModal
      v-model:open="addOpen"
      :existing-ids="existingServiceIds"
      @select="onAddService"
    />
  </UiCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  UiButton, UiCard, UiTitle, UiText, UiTag, UiEmpty, UiSelect,
} from '@fastio/ui'
import type { ServiceWithBranchIds } from '@fastio/shared'
import { formatPrice, formatMinutes } from '@fastio/shared'
import type { EditorService } from '~/components/appointments/types'
import AddServiceModal from '~/components/appointments/AddServiceModal.vue'

defineProps<{
  services: EditorService[]
  existingServiceIds: string[]
  isReadOnly: boolean
  saving: boolean
  resourceOptionsFor: (serviceId: string) => Array<{ label: string; value: string }>
  resourceDisplayName: (svc: EditorService) => string
  appointmentTimeRange: (appointmentId: string) => string
}>()

const emit = defineEmits<{
  add: [service: ServiceWithBranchIds]
  remove: [key: string]
  restore: [key: string]
}>()

const addOpen = ref(false)

const onAddService = (svc: ServiceWithBranchIds) => {
  emit('add', svc)
  addOpen.value = false
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.card-title {
  margin-bottom: var(--space-12);
}

.service-list {
  @include flex-col(var(--space-12));
  margin-bottom: var(--space-12);
}

.service-card {
  @include flex-col(var(--space-8));

  &--cancelled {
    opacity: 0.6;
  }
}

.service-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.service-main {
  @include flex-col(var(--space-4));
  flex: 1;
  min-width: 0;
}

.service-name {
  font-weight: var(--font-weight-medium);
}

.service-meta {
  color: var(--color-text-secondary);
}

.add-service-btn {
  align-self: flex-start;
}

.muted {
  color: var(--color-text-secondary);
}
</style>
