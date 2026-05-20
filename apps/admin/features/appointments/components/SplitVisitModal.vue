<template>
  <UiModal
    v-model="open"
    title="Разделить визит"
    :width="480"
    :loading="loading"
    :on-confirm="handleConfirm"
    :actions="[
      { text: 'Отмена', actionType: 'decline' },
      { text: confirmText, actionType: 'confirm', type: 'primary', disabled: !canConfirm },
    ]"
  >
    <div class="root">
      <UiText size="small" class="muted">
        Выберите услуги, которые перенесёте в отдельную заявку. После подтверждения
        будет создана новая заявка на этого же клиента — выбрать дату и слоты можно
        будет на её странице.
      </UiText>

      <div class="service-list">
        <ServiceCard
          v-for="a in eligible"
          :key="a.id"
          compact
          clickable
          :name="a.serviceName"
          :price="a.servicePrice"
          :duration-minutes="durationOf(a)"
          :start-time="localTime(a.startsAt)"
          :end-time="localTime(a.endsAt)"
          :master-name="resourceName(a.resourceId)"
          :selected="selected.has(a.id)"
          @click="toggle(a.id)"
        />
      </div>
      <UiText v-if="!eligible.length" size="small" class="muted">
        Нет активных услуг для переноса.
      </UiText>

      <UiAlert v-if="allSelected" type="warning">
        Чтобы перенести весь визит на другую дату, не нужно его делить — просто
        смените дату визита в основном редакторе.
      </UiAlert>

      <UiAlert v-if="errorMsg" type="error">{{ errorMsg }}</UiAlert>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  UiModal, UiText, UiAlert, useMessage,
} from '@fastio/ui'
import { useRouter } from '#imports'
import type { Appointment, Visit, Resource } from '@fastio/shared'
import { utcIsoToLocalDateTime } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '@fastio/shared/observability'
import ServiceCard from './ServiceCard.vue'

const props = defineProps<{
  visit: Visit
  appointments: Appointment[]
}>()

const emit = defineEmits<{ done: [] }>()

const open = defineModel<boolean>({ required: true })

const tenantStore = useTenantStore()
const authStore = useAuthStore()
const api = useDatabase()
const message = useMessage()
const router = useRouter()

const loading = ref(false)
const errorMsg = ref<string | null>(null)
const selected = ref<Set<string>>(new Set())
const allResources = ref<Resource[]>([])
const dataLoaded = ref(false)

const tz = computed(() => tenantStore.tenant?.timezone ?? 'UTC')

const eligible = computed(() => props.appointments.filter((a) => a.status === 'new' || a.status === 'confirmed'))

const localTime = (iso: string): string => utcIsoToLocalDateTime(iso, tz.value).timeStr
const durationOf = (a: Appointment): number => Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000)
const resourceName = (id: string | null): string => {
  if (!id) return 'Любой исполнитель'

  return allResources.value.find((r) => r.id === id)?.name ?? 'Неизвестный исполнитель'
}

const allSelected = computed(() => selected.value.size > 0 && selected.value.size === eligible.value.length)
const canConfirm = computed(() => selected.value.size > 0 && !allSelected.value)

// Текст кнопки стабильный — «Перенести (N)». Disabled-состояние решается отдельно
// через canConfirm (пусто или выбраны все).
const confirmText = computed(() => `Перенести (${selected.value.size})`)

const toggle = (id: string) => {
  const next = new Set(selected.value)

  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

const ensureDataLoaded = async () => {
  if (dataLoaded.value) return
  const tid = tenantStore.currentTenantId

  if (!tid) return
  try {
    allResources.value = (await api.resources.list(tid)).filter((r) => r.isActive)
    dataLoaded.value = true
  } catch (e) {
    reportError(e)
  }
}

watch(open, (v) => {
  if (!v) return
  selected.value = new Set()
  errorMsg.value = null
  ensureDataLoaded()
})

const handleConfirm = async (): Promise<boolean | void> => {
  errorMsg.value = null
  const userId = authStore.user?.id

  if (!userId) {
    errorMsg.value = 'Не авторизован'

    return false
  }
  if (!canConfirm.value) return false

  loading.value = true
  try {
    const ids = Array.from(selected.value)
    const result = await api.visits.splitToRequest(props.visit.id, ids, userId)

    // router.resolve гарантирует префикс/трейлинг строго по router-конфигу,
    // не пишем magic-string «/appointments/visits/...» руками.
    const url = router.resolve({ path: `/appointments/visits/${result.newVisitId}` }).href

    message.success('Заявка создана — открываю в новой вкладке')
    window.open(url, '_blank', 'noopener')
    emit('done')
  } catch (e) {
    reportError(e)
    errorMsg.value = (e as Error)?.message ?? 'Не удалось разделить визит'

    return false
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.root {
  @include flex-col(var(--space-12));
}

.muted {
  color: var(--color-text-secondary);
}

.service-list {
  @include flex-col(var(--space-8));
}
</style>
