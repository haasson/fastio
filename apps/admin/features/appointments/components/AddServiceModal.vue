<template>
  <UiModal
    :model-value="open"
    title="Добавить услугу"
    :width="520"
    :actions="actions"
    @update:model-value="(v: boolean) => emit('update:open', v)"
  >
    <div class="modal-body">
      <UiInput
        v-model="search"
        placeholder="Поиск услуги по названию"
        clearable
      />

      <UiSkeleton v-if="loading" :repeat="4" />

      <UiEmpty
        v-else-if="filtered.length === 0"
        icon="search"
        :text="search ? 'Услуги по запросу не найдены' : 'Активных услуг нет'"
      />

      <div v-else class="service-list">
        <UiCard
          v-for="svc in filtered"
          :key="svc.id"
          size="small"
          clickable
          class="service-card"
          :class="{ 'service-card--disabled': isAlreadyAdded(svc.id) }"
          @click="onPick(svc)"
        >
          <div class="service-row">
            <div class="service-main">
              <UiText class="service-name">{{ svc.name }}</UiText>
              <UiText size="small" class="service-meta">
                {{ formatMinutes(svc.duration) }} • {{ formatPrice(svc.price) }}
              </UiText>
            </div>
            <UiTag v-if="isAlreadyAdded(svc.id)" size="small" type="default">Уже добавлена</UiTag>
          </div>
        </UiCard>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  UiModal, UiInput, UiCard, UiText, UiTag,
  UiEmpty, UiSkeleton, useMessage,
} from '@fastio/ui'
import type { ModalAction } from '@fastio/ui'
import type { ServiceWithBranchIds } from '@fastio/shared'
import { formatPrice, formatMinutes } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '~/shared/utils/reportError'

type Props = {
  open: boolean
  existingIds: string[]
  // null = тенант моно-филиальный или фильтр не применяется (preset без branchId).
  branchId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [boolean]
  'select': [ServiceWithBranchIds]
}>()

const api = useDatabase()
const tenantStore = useTenantStore()
const message = useMessage()

const services = ref<ServiceWithBranchIds[]>([])
const loading = ref(false)
const search = ref('')
const loaded = ref(false)

const loadServices = async () => {
  if (loaded.value) return
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return

  loading.value = true
  try {
    services.value = await api.services.listActive(tenantId)
    loaded.value = true
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить услуги')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) loadServices()
}, { immediate: true })

const filtered = computed<ServiceWithBranchIds[]>(() => {
  const q = search.value.trim().toLowerCase()
  // Только bookable — иначе пользователь сможет добавить розничный товар как услугу.
  const bid = props.branchId ?? null
  const list = services.value.filter((s) => {
    if (!s.isBookable) return false
    // Фильтр по филиалу: пустой service_branches = «во всех филиалах».
    if (bid && s.branchIds.length > 0 && !s.branchIds.includes(bid)) return false

    return true
  })

  if (!q) return list

  return list.filter((s) => s.name.toLowerCase().includes(q))
})

const isAlreadyAdded = (id: string): boolean => props.existingIds.includes(id)

const onPick = (svc: ServiceWithBranchIds) => {
  if (isAlreadyAdded(svc.id)) {
    message.info('Эта услуга уже добавлена в запись')

    return
  }
  emit('select', svc)
  search.value = ''
}

const actions: ModalAction[] = [
  { text: 'Закрыть', type: 'default', actionType: 'decline' },
]
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.modal-body {
  @include flex-col(var(--space-12));
  max-height: 60vh;
  overflow-y: auto;
}

.service-list {
  @include flex-col(var(--space-8));
}

.service-card {
  &--disabled {
    opacity: 0.5;
  }
}

.service-row {
  display: flex;
  align-items: center;
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
</style>
