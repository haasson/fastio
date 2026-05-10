<template>
  <UiCard>
    <UiTitle size="h4" class="card-title">Слоты для услуги</UiTitle>

    <UiText v-if="!selectedService" size="small" class="muted">
      Выберите услугу слева, чтобы подобрать время и исполнителя.
    </UiText>

    <template v-else>
      <UiText size="small" class="service-label">
        {{ selectedService.serviceName }}
      </UiText>

      <UiSelect
        v-if="!isReadOnly"
        :value="resourceSelectValue"
        :options="resourceOptionsWithAny"
        placeholder="Любой исполнитель"
        size="small"
        class="resource-select"
        :disabled="loading"
        @update:value="onChangeResource"
      />

      <UiAlert v-if="!hasDate" type="warning">
        Сначала выберите дату визита — после этого появятся доступные слоты.
      </UiAlert>

      <SlotChipGrid
        v-else
        :result="slotsResult"
        :loading="loading"
        :is-selected="isEntrySelected"
        empty-text="На этот день свободных вариантов нет. Поменяйте мастера или перенесите визит на другой день."
        @click="onChipClick"
      />
    </template>

    <SlotSwapResourceModal
      v-if="selectedService"
      v-model="swapOpen"
      :start-time="swapEntry?.startTime ?? ''"
      :end-time="swapEntry?.schedule[0].endTime ?? ''"
      :preferred-resource-id="selectedService.preferredResourceId"
      :resource-options="freeResourceOptionsForSwap"
      @apply="onSwapApply"
    />
  </UiCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiCard, UiTitle, UiText, UiSelect, UiAlert } from '@fastio/ui'
import type { GroupSlotEntry, GroupSlotsResult } from '@fastio/shared'
import type { EditorService } from '~/features/appointments/components/types'
import SlotSwapResourceModal from '~/features/appointments/components/SlotSwapResourceModal.vue'
import SlotChipGrid from '~/features/appointments/components/SlotChipGrid.vue'

const ANY_RESOURCE = ''

const props = defineProps<{
  selectedService: EditorService | null
  loading: boolean
  slotsResult: GroupSlotsResult | null
  isReadOnly: boolean
  // Дата визита уже выбрана. Если false — слот-пикер не имеет смысла,
  // показываем подсказку «выберите дату» вместо «нет вариантов».
  hasDate: boolean
  resourceOptionsFor: (serviceId: string) => Array<{ label: string; value: string }>
  resourceDisplayName: (svc: EditorService) => string
  serviceNameById: (serviceId: string) => string
}>()

const emit = defineEmits<{
  selectSlot: [slot: { startTime: string; endTime: string; resourceId: string }]
  setPreferredResource: [key: string, resourceId: string | null]
}>()

const resourceSelectValue = computed(() => props.selectedService?.preferredResourceId ?? ANY_RESOURCE)

const resourceOptionsWithAny = computed(() => {
  if (!props.selectedService) return [{ label: 'Любой исполнитель', value: ANY_RESOURCE }]

  return [
    { label: 'Любой исполнитель', value: ANY_RESOURCE },
    ...props.resourceOptionsFor(props.selectedService.serviceId),
  ]
})

// Опции для модалки замены: только реально свободные в этот слот ресурсы.
// availableResourceIds кладёт сам алгоритм поиска слотов (см. findGroupSlots).
const freeResourceOptionsForSwap = computed(() => {
  if (!props.selectedService || !swapEntry.value) return []
  const allOpts = props.resourceOptionsFor(props.selectedService.serviceId)
  const free = new Set(swapEntry.value.schedule[0].availableResourceIds)

  return allOpts.filter((o) => free.has(o.value))
})

const onChangeResource = (value: unknown) => {
  if (!props.selectedService) return
  const v = value === ANY_RESOURCE ? null : (value as string)

  emit('setPreferredResource', props.selectedService._key, v)
}

const isEntrySelected = (entry: GroupSlotEntry): boolean => {
  if (!props.selectedService) return false

  return props.selectedService.currentStartTime === entry.startTime
    && props.selectedService.currentResourceId === entry.schedule[0].resourceId
}

// Когда у выбранной услуги задан конкретный preferred мастер: зелёный = он свободен,
// назначаем сразу; жёлтый = пришлось бы подменять, открываем модалку выбора.
// Когда preferred НЕ задан (клиент выбрал «любой» или редактор скинул его для
// auto-assigned услуги): все слоты зелёные «у кого-то свободно», но кто
// конкретно — алгоритм возьмёт первого. Чтобы менеджер не получал случайного
// назначения, ВСЕГДА открываем модалку — пусть выбирает осознанно.
const swapOpen = ref(false)
const swapEntry = ref<GroupSlotEntry | null>(null)

const onChipClick = (entry: GroupSlotEntry) => {
  const hasPreferred = props.selectedService?.preferredResourceId != null
  const needsManualPick = entry.match === 'any' || !hasPreferred
  const free = entry.schedule[0].availableResourceIds

  // Модалка нужна только когда реально есть из чего выбирать. Если свободен
  // ровно один — назначаем его сразу, без вопросов. Это и для жёлтых, и для
  // «любой исполнитель» с одним кандидатом.
  if (needsManualPick && free.length > 1) {
    swapEntry.value = entry
    swapOpen.value = true

    return
  }

  emit('selectSlot', {
    startTime: entry.startTime,
    endTime: entry.schedule[0].endTime,
    resourceId: free[0] ?? entry.schedule[0].resourceId,
  })
}

const onSwapApply = (resourceId: string) => {
  if (!swapEntry.value) return
  emit('selectSlot', {
    startTime: swapEntry.value.startTime,
    endTime: swapEntry.value.schedule[0].endTime,
    resourceId,
  })
  swapOpen.value = false
  swapEntry.value = null
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.card-title {
  margin-bottom: var(--space-12);
}

.muted {
  color: var(--color-text-secondary);
}

.service-label {
  display: block;
  margin-bottom: var(--space-12);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.resource-select {
  margin-bottom: var(--space-12);
}
</style>
