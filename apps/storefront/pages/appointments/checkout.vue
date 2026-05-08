<template>
  <PageShell>
    <FsSection>
      <StorePageLayout
        :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Корзина', to: '/cart' }]"
        :current="currentLabel"
      >
        <div class="checkout-wrap">

          <!-- Date strip with green/yellow dots — always shown unless we're in success/request -->
          <ApptGroupDateStep
            v-if="step === 'date' || step === 'slots'"
            :selected-date="groupDate"
            :horizon-days="horizonDays"
            :week-matches="weekMatches"
            :timezone="timezone"
            :show-legend="anyServiceHasPreferred"
            @update:selected-date="onSelectDate"
            @fetch-week="fetchWeek"
          />

          <ApptGroupSlots
            v-if="step === 'slots'"
            :result="groupSlotsResult"
            :loading="loading"
            :selected-entry="selectedEntry"
            :service-names="serviceNames"
            :preferred-resource-by-service="preferredResourceByService"
            @update:selected-entry="selectedEntry = $event"
            @confirm="step = 'contact'"
            @request-only="step = 'request'"
          />

          <ApptGroupRequest
            v-else-if="step === 'request'"
            :loading="submitting"
            :services="servicesList"
            :reason="groupSlotsResult?.type === 'request_only' ? 'too-long' : 'manual'"
            @submit="onRequestSubmit"
            @back="step = 'date'"
          />

          <ApptStepContact
            v-else-if="step === 'contact'"
            v-model:form="contactForm"
            :loading="submitting"
            @submit="submitGroupBooking"
            @back="step = 'slots'"
          />

          <ApptGroupSuccess
            v-else-if="step === 'success' && groupResult"
            :appointments="groupResult.appointments"
            :service-names="successServiceNames"
            :timezone="timezone"
          />

          <FsAlert v-if="error" type="error" class="error-alert">{{ error }}</FsAlert>

          <FsAlert
            v-if="step === 'date' || step === 'slots'"
            type="muted"
            class="request-hint"
          >
            <span class="hint-text">Не нашли удобное время? Оставьте заявку — подберём вместе.</span>
            <FsButton variant="ghost" size="small" @click="step = 'request'">
              Оставить заявку
            </FsButton>
          </FsAlert>

          <FsButton
            v-if="step === 'date' || step === 'slots'"
            variant="ghost"
            size="small"
            class="back-to-cart"
            @click="navigateTo('/cart')"
          >
            ← В корзину
          </FsButton>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { navigateTo, useNuxtData, useRequestFetch, useRoute } from 'nuxt/app'
import type { Tenant, AppointmentSettings, GroupSlotsResult, GroupSlotEntry, GroupSlotMatch } from '@fastio/shared'
import { DEFAULT_TIMEZONE } from '@fastio/shared'
import { FsSection, FsAlert, FsButton } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import ApptGroupDateStep from '~/components/appointments/ApptGroupDateStep.vue'
import ApptGroupSlots from '~/components/appointments/ApptGroupSlots.vue'
import ApptGroupRequest from '~/components/appointments/ApptGroupRequest.vue'
import ApptStepContact from '~/components/appointments/ApptStepContact.vue'
import ApptGroupSuccess from '~/components/appointments/ApptGroupSuccess.vue'
import { useCartStore } from '~/stores/cart'
import { useSelectedBranchStore } from '~/stores/selectedBranch'
import { useToast } from '~/composables/useToast'
import { reportError } from '~/utils/reportError'
import { useResourceLabel } from '~/composables/useResourceLabel'

type Step = 'date' | 'slots' | 'request' | 'contact' | 'success'
type GroupResult = {
  visitId?: string
  appointments: Array<{ id: string; startsAt: string; endsAt: string; serviceId: string }>
}

const rfetch = useRequestFetch()
const { data: tenant } = useNuxtData<Tenant>('tenant')
const cart = useCartStore()
const branchStore = useSelectedBranchStore()
const { success: showSuccess, error: showError } = useToast()

const timezone = computed(() => tenant.value?.timezone ?? DEFAULT_TIMEZONE)

const step = ref<Step>('date')
const groupDate = ref<string | null>(null)
const groupSlotsResult = ref<GroupSlotsResult | null>(null)
const selectedEntry = ref<GroupSlotEntry | null>(null)
const weekMatches = ref<Record<string, GroupSlotMatch | null>>({})
const inflightDates = new Set<string>()
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const groupResult = ref<GroupResult | null>(null)
const horizonDays = ref(30)

const contactForm = ref({
  customerName: '',
  customerPhone: '',
  notes: '',
})

const serviceNames = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const item of cart.serviceItems) {
    map[item.serviceId] = item.serviceName
  }
  return map
})

// Снапшот имён услуг для success-экрана: cart очищается ПОСЛЕ перехода на
// step='success', и ApptGroupSuccess успевает отреагировать на пустой cart →
// показывает UUID вместо названий. Снимаем снапшот в submitGroupBooking перед
// commitClearServices().
const successServiceNames = ref<Record<string, string>>({})

const resourceNamesMap = ref<Map<string, string>>(new Map())
const { anyLabel: anyResourceLabel } = useResourceLabel()

const anyServiceHasPreferred = computed(() => cart.serviceItems.some((i) => i.preferredResourceId))

const preferredResourceByService = computed<Record<string, string | null>>(() => {
  const map: Record<string, string | null> = {}
  for (const item of cart.serviceItems) {
    map[item.serviceId] = item.preferredResourceId ?? null
  }
  return map
})

const servicesList = computed(() =>
  cart.serviceItems.map((item) => ({
    id: item.serviceId,
    name: item.serviceName,
    duration: item.duration,
    masterName: item.preferredResourceId
      ? resourceNamesMap.value.get(item.preferredResourceId) ?? anyResourceLabel.value
      : undefined,
  })),
)

const currentLabel = computed(() => {
  if (step.value === 'request') return 'Заявка'
  if (step.value === 'success') return 'Готово'
  if (step.value === 'contact') return 'Контакты'
  return 'Выбор времени'
})

const itemsForApi = () => cart.serviceItems.map((item) => ({
  serviceId: item.serviceId,
  preferredResourceId: item.preferredResourceId ?? undefined,
}))

const route = useRoute()
let resourceNamesLoaded = false

const loadResourceNames = async () => {
  if (resourceNamesLoaded) return
  resourceNamesLoaded = true
  const items = cart.serviceItems.filter((i) => i.preferredResourceId)
  if (items.length === 0) return

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const list = await $fetch<Array<{ id: string; name: string }>>(
        `/api/appointments/resources?serviceId=${item.serviceId}`,
      )
      return { resourceId: item.preferredResourceId!, list }
    }),
  )
  const next = new Map<string, string>(resourceNamesMap.value)
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const found = r.value.list.find((x) => x.id === r.value.resourceId)
      if (found) next.set(r.value.resourceId, found.name)
    } else {
      reportError(r.reason instanceof Error ? r.reason : new Error('[checkout] failed to load resources'))
    }
  }
  resourceNamesMap.value = next
}

watch(step, (s) => {
  if (s === 'request') loadResourceNames()
})

// Если корзина услуг опустела (например, юзер сменил филиал → удалились все услуги),
// возвращаем на /cart. Исключаем step=success: там корзина зачищена намеренно после
// успешной записи, и юзер должен видеть экран успеха.
watch(
  () => cart.serviceCount,
  (count) => {
    if (count === 0 && step.value !== 'success' && cart.restored) {
      navigateTo('/cart', { replace: true })
    }
  },
)

onMounted(async () => {
  if (cart.serviceCount === 0) {
    await navigateTo('/cart', { replace: true })
    return
  }

  if (route.query.request === '1') {
    step.value = 'request'
    loadResourceNames()
  }

  try {
    const sett = await rfetch<Partial<AppointmentSettings>>('/api/appointments/settings')
    if (sett?.bookingHorizonDays) horizonDays.value = sett.bookingHorizonDays
  } catch (e) {
    reportError(e)
  }
})

const fetchWeek = async (dates: string[]) => {
  const toFetch = dates.filter(d => !(d in weekMatches.value) && !inflightDates.has(d))
  if (toFetch.length === 0) return

  for (const d of toFetch) inflightDates.add(d)
  try {
    const params = new URLSearchParams({
      dates: toFetch.join(','),
      items: JSON.stringify(itemsForApi()),
    })
    if (branchStore.id) params.set('branchId', branchStore.id)
    const res = await rfetch<Array<{ date: string; match: GroupSlotMatch | null }>>(
      `/api/appointments/group-week?${params}`,
    )
    const next = { ...weekMatches.value }
    for (const r of res) next[r.date] = r.match
    weekMatches.value = next
  } catch (e) {
    // Точки на стрипе — украшение, не блокер; ошибку молча не глотаем
    reportError(e instanceof Error ? e : new Error('[appointments/checkout] failed to load group-week'))
  } finally {
    for (const d of toFetch) inflightDates.delete(d)
  }
}

let slotsLoadGen = 0

const onSelectDate = async (date: string) => {
  groupDate.value = date
  selectedEntry.value = null
  error.value = ''
  step.value = 'slots'
  loading.value = true
  const gen = ++slotsLoadGen
  try {
    const params = new URLSearchParams({
      date,
      items: JSON.stringify(itemsForApi()),
    })
    if (branchStore.id) params.set('branchId', branchStore.id)
    const result = await rfetch<GroupSlotsResult>(`/api/appointments/group-slots?${params}`)
    if (gen === slotsLoadGen) groupSlotsResult.value = result
  } catch (e) {
    reportError(e instanceof Error ? e : new Error('[appointments/checkout] failed to load group-slots'))
    if (gen === slotsLoadGen) error.value = 'Не удалось загрузить доступное время'
  } finally {
    if (gen === slotsLoadGen) loading.value = false
  }
}

// Смена филиала из шапки/бургера — кэш точек и текущие слоты были посчитаны
// для старого филиала, в новом картина другая. Сбрасываем и перезагружаем
// то, что юзер уже видит (видимая неделя + выбранная дата). Также возвращаем
// юзера на step='date' если он успел уйти на 'contact'/'request' — слот сброшен,
// форма контактов без времени бесполезна.
watch(() => branchStore.id, () => {
  const previousDates = Object.keys(weekMatches.value)
  weekMatches.value = {}
  selectedEntry.value = null
  if (previousDates.length > 0) fetchWeek(previousDates)

  if (groupDate.value && step.value === 'slots') {
    onSelectDate(groupDate.value)
  } else {
    groupSlotsResult.value = null
  }

  // Если юзер был на 'contact' / 'request' — слот теперь невалиден, возвращаем на выбор даты.
  if (step.value === 'contact' || step.value === 'request') {
    step.value = 'date'
  }
})

const onRequestSubmit = async (form: { customerName: string; customerPhone: string; notes: string }) => {
  submitting.value = true
  error.value = ''

  const commitClearServices = cart.clearServices()

  try {
    await $fetch('/api/appointments/request', {
      method: 'POST',
      body: {
        branchId: branchStore.id ?? null,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        notes: form.notes || null,
        services: cart.serviceItems.map((i) => ({
          serviceId: i.serviceId,
          preferredResourceId: i.preferredResourceId ?? null,
        })),
      },
    })
    commitClearServices()
    showSuccess('Заявка отправлена! Менеджер свяжется с вами.')
    await navigateTo('/')
  } catch (e: unknown) {
    reportError(e instanceof Error ? e : new Error('[appointments/checkout] failed to submit request'))
    const status = (e as { status?: number })?.status
    const msg = (e as { data?: { message?: string } })?.data?.message
    if (status === 429) {
      showError('Слишком много заявок, попробуйте через минуту.')
    } else if (status === 400 && msg) {
      showError(msg)
    } else {
      showError('Не удалось отправить заявку. Попробуйте ещё раз.')
    }
  } finally {
    submitting.value = false
  }
}

const submitGroupBooking = async () => {
  if (!selectedEntry.value || !groupDate.value) return
  submitting.value = true
  error.value = ''

  // Snapshot service-позиций до запроса — после успеха удалим только их.
  const commitClearServices = cart.clearServices()

  try {
    // Для items, у которых клиент в корзине выбрал «любой исполнитель»
    // (preferredResourceId == null), шлём resourceId=null — бэк сам подберёт
    // по round-robin и пометит как 'auto'. Иначе передаём конкретного, кого
    // подобрал group-slots под клиентское предпочтение → бэк сохранит как 'client'.
    // Лукап по serviceId, не по индексу: серверная перестановка может выдать
    // schedule в другом порядке относительно cart.serviceItems (см. план 10.1).
    const preferredMap = preferredResourceByService.value
    const body = {
      branchId: branchStore.id ?? null,
      items: selectedEntry.value.schedule.map((entry) => ({
        serviceId: entry.serviceId,
        resourceId: preferredMap[entry.serviceId] ? entry.resourceId : null,
        startTime: entry.startTime,
        // Overnight (план 1a): для услуги в фазе D+1 (когда смена 22:00→04:00
        // и услуга стартует после полуночи) бэк строит UTC через date+1.
        isNextDay: entry.startIsNextDay,
      })),
      date: groupDate.value,
      customerName: contactForm.value.customerName,
      customerPhone: contactForm.value.customerPhone,
      notes: contactForm.value.notes || undefined,
    }

    const headers: Record<string, string> = {}
    const { useSupabaseClient } = await import('~/composables/useSupabaseClient')
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) headers.Authorization = `Bearer ${session.access_token}`

    const res = await $fetch<GroupResult>('/api/appointments/bulk', { method: 'POST', body, headers })
    groupResult.value = res
    successServiceNames.value = { ...serviceNames.value }
    step.value = 'success'
    commitClearServices()
  } catch (e: unknown) {
    reportError(e instanceof Error ? e : new Error('[appointments/checkout] failed to create bulk booking'))
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg ?? 'Не удалось создать запись. Попробуйте ещё раз.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.checkout-wrap {
  max-width: 480px;
  margin: 0 auto;
  @include flex-col(20px);
}

.error-alert {
  margin-top: 12px;
}

.request-hint {
  margin-top: 4px;

  :deep(.fs-alert-content) {
    @include flex-between(12px);
    flex-wrap: wrap;
  }
}

.hint-text {
  @include text-xs;
  flex: 1;
  min-width: 0;
}

.back-to-cart {
  align-self: center;
  margin-top: 4px;
}
</style>
