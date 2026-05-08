<template>
  <UiCard>
    <UiTitle size="h4" class="card-title">Услуги</UiTitle>

    <UiEmpty
      v-if="services.length === 0"
      icon="calendar"
      text="Услуги не добавлены"
    />

    <div v-else class="service-list">
      <ServiceCard
        v-for="svc in services"
        :key="svc._key"
        :name="svc.serviceName"
        :price="svc.price"
        :duration-minutes="svc.durationMinutes"
        :start-time="svc.currentStartTime"
        :end-time="svc.currentEndTime"
        :master-name="resourceDisplayName(svc)"
        :show-any-master="showAnyMasterFor(svc)"
        :original-start-time="svc.originalStartTime"
        :original-end-time="svc.originalEndTime"
        :original-master-name="originalMasterFor(svc)"
        :pending-remove="svc.pendingRemove"
        :clickable="!svc.pendingRemove"
        :selected="selectedKey === svc._key"
        :show-remove="!isReadOnly && !svc.pendingRemove"
        :show-restore="!isReadOnly && svc.pendingRemove"
        :time-invalid="timeInvalidFor(svc)"
        :master-invalid="masterInvalidFor(svc)"
        :alert-text="alertTextFor(svc)"
        @click="emit('select', svc._key)"
        @remove="emit('remove', svc._key)"
        @restore="emit('restore', svc._key)"
      />
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
      :branch-id="branchId ?? null"
      @select="onAddService"
    />
  </UiCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiCard, UiTitle, UiEmpty } from '@fastio/ui'
import type { Appointment, ServiceWithBranchIds } from '@fastio/shared'
import type { EditorService } from '~/components/appointments/types'
import { isSlotChanged } from '~/components/appointments/types'
import AddServiceModal from '~/components/appointments/AddServiceModal.vue'
import ServiceCard from '~/components/appointments/ServiceCard.vue'

const props = defineProps<{
  services: EditorService[]
  existingServiceIds: string[]
  isReadOnly: boolean
  saving: boolean
  // Текущий выбранный филиал визита — для фильтрации списка добавляемых услуг.
  branchId?: string | null
  appointments?: Appointment[] | null
  selectedKey: string | null
  resourceDisplayName: (svc: EditorService) => string
  resourceNameById: (id: string | null) => string
  // _key → причина невалидности слота на текущую дату визита.
  //   'ok'         — слот валиден (или ещё не проверен).
  //   'time-busy'  — мастер свободен в день, но не в это время — подсветка время.
  //   'master-off' — мастер не работает / весь день занят — подсветка мастер+время.
  //   'all-empty'  — никто из компетентных мастеров не доступен — подсветка всё.
  validityByKey?: Record<string, 'ok' | 'time-busy' | 'master-off' | 'all-empty'>
}>()

const emit = defineEmits<{
  add: [service: ServiceWithBranchIds]
  remove: [key: string]
  restore: [key: string]
  select: [key: string]
}>()

const addOpen = ref(false)

const originalMasterFor = (svc: EditorService): string | null => {
  if (!svc.appointmentId) return null
  // Если изначально мастера выбирал алгоритм (auto), то «старого» в UI не было
  // — менеджер видел «Любой исполнитель». При смене НЕ показываем зачёркнутого
  // Ивана → Машу: было «Любой → Маша», в карточке отрендерим просто «Маша».
  if (masterAssignedByOf(svc) === 'auto') return null

  return props.resourceNameById(svc.originalResourceId)
}

const masterAssignedByOf = (svc: EditorService): 'client' | 'auto' | 'admin' | null => {
  if (!svc.appointmentId) return null
  const a = (props.appointments ?? []).find((x) => x.id === svc.appointmentId)

  return a?.resourceAssignedBy ?? null
}

// «Любой исполнитель» в карточке: новая услуга без выбранного слота ИЛИ
// существующая, для которой мастера подбирал бэк (auto) и менеджер ничего не
// менял (slot не изменился). Как только менеджер ткнёт конкретного мастера
// через slot-pick → isSlotChanged станет true и покажем имя.
const showAnyMasterFor = (svc: EditorService): boolean => {
  if (!svc.currentResourceId) return true
  if (isSlotChanged(svc)) return false

  return masterAssignedByOf(svc) === 'auto'
}

// Маппинг status → пропсы карточки.
//   time-busy   — подсветить только время (мастер ок).
//   master-off  — подсветить мастера И время (без мастера время бессмысленно).
//   all-empty   — подсветить всё.
const validityOf = (svc: EditorService) => props.validityByKey?.[svc._key] ?? 'ok'

const timeInvalidFor = (svc: EditorService): boolean => {
  const v = validityOf(svc)

  return v === 'time-busy' || v === 'master-off' || v === 'all-empty'
}

const masterInvalidFor = (svc: EditorService): boolean => {
  const v = validityOf(svc)

  return v === 'master-off' || v === 'all-empty'
}

const alertTextFor = (svc: EditorService): string => {
  const v = validityOf(svc)

  if (v === 'time-busy') return 'У этого мастера занято на это время. У него есть другие свободные слоты — выберите другое время.'
  if (v === 'master-off') return 'Этот мастер не работает в этот день. Услугу выполнят другие — выберите другого мастера и время.'
  if (v === 'all-empty') return 'На эту дату эту услугу никто не сможет сделать. Перенесите визит на другой день.'

  return ''
}

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

.add-service-btn {
  align-self: flex-start;
}
</style>
