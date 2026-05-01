import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useMessage } from '@fastio/ui'
import type {
  Appointment, Visit,
  Resource, ServiceWithBranchIds,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useGate } from '~/composables/plan/useGate'
import { useDatabase } from '~/composables/data/useDatabase'
import { useEditorCompetencies } from '~/composables/data/useEditorCompetencies'
import { reportError } from '~/utils/reportError'
import type { EditorService, EditorState } from '~/components/appointments/types'
import { newKey, prefillFromVisit, prefillFromRequestVisit } from '~/composables/data/appointmentEditor/utils'
import { useEditorSnapshot } from '~/composables/data/appointmentEditor/useEditorSnapshot'
import { useEditorSave } from '~/composables/data/appointmentEditor/useEditorSave'
import { useServiceSlots } from '~/composables/data/useServiceSlots'
import { useGroupSlotSearch } from '~/composables/data/useGroupSlotSearch'

type Preset = {
  date: string | null
  slotTime: string | null
  preferredResourceId: string | null
  branchId: string | null
}

type Props = {
  mode: 'edit' | 'create'
  initialVisit?: Visit | null
  initialAppointments?: Appointment[]
  initialPreset?: Preset | null
}

/**
 * Главный композабл редактора визита. Отвечает за state, lookups, поиск
 * слотов для выбранной услуги и сохранение. Без общего слот-пикера всего
 * визита (был раньше) — каждая услуга подбирает слот независимо в день
 * `state.date` (= visit.businessDate в edit-mode).
 */
export function useAppointmentEditorState(props: Props) {
  const api = useDatabase()
  const gate = useGate()
  const tenantStore = useTenantStore()
  const appointmentSettingsStore = useAppointmentSettingsStore()
  const message = useMessage()
  const competenciesHelper = useEditorCompetencies()

  const tz = computed(() => tenantStore.tenant?.timezone ?? 'UTC')
  const canManage = computed(() => gate.manageAppointments.value.enabled)
  const isReadOnly = computed(() => !canManage.value)

  const state = reactive<EditorState>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
    branchId: null,
    date: null,
    services: [],
  })

  const loadingResources = ref(true)
  const allResources = ref<Resource[]>([])
  const allServices = ref<ServiceWithBranchIds[]>([])

  const resourcesById = computed(() => Object.fromEntries(allResources.value.map((r) => [r.id, r])))

  const resourceOptionsFor = (serviceId: string) => {
    const map = competenciesHelper.competencyByResource.value

    return allResources.value
      .filter((r) => map.get(r.id)?.has(serviceId))
      .map((r) => ({ label: r.name, value: r.id }))
  }

  const serviceNameById = (serviceId: string): string => state.services.find((s) => s.serviceId === serviceId)?.serviceName
    ?? allServices.value.find((s) => s.id === serviceId)?.name
    ?? '—'

  const resourceDisplayName = (svc: EditorService): string => {
    const id = svc.currentResourceId ?? svc.preferredResourceId

    if (id) return resourcesById.value[id]?.name ?? 'Неизвестный исполнитель'

    return 'Любой исполнитель'
  }

  const resourceNameById = (id: string | null): string => {
    if (!id) return 'Любой исполнитель'

    return resourcesById.value[id]?.name ?? 'Неизвестный исполнитель'
  }

  const totals = computed(() => {
    const active = state.services.filter((s) => !s.pendingRemove)

    return {
      duration: active.reduce((sum, s) => sum + s.durationMinutes, 0),
      price: active.reduce((sum, s) => sum + s.price, 0),
    }
  })

  const existingServiceIds = computed(() => state.services.filter((s) => !s.pendingRemove).map((s) => s.serviceId))
  const activeServicesCount = computed(() => state.services.filter((s) => !s.pendingRemove).length)

  const { snapshot, takeSnapshot, takeMetaSnapshot, dirty } = useEditorSnapshot(state, props.mode)

  // ─── Per-service slot picker ──────────────────────────────────────────────
  // Юзер кликает по карточке услуги в списке → выбранный _key уезжает сюда,
  // а useServiceSlots грузит чипсы под выбранную услугу + день (= state.date).
  const selectedServiceKey = ref<string | null>(null)

  const selectedService = computed(() => state.services.find((s) => s._key === selectedServiceKey.value) ?? null)

  const slotInput = computed(() => {
    if (!state.date || !selectedService.value || selectedService.value.pendingRemove) return null

    return {
      date: state.date,
      serviceId: selectedService.value.serviceId,
      duration: selectedService.value.durationMinutes,
      preferredResourceId: selectedService.value.preferredResourceId,
      excludeAppointmentId: selectedService.value.appointmentId,
      branchId: state.branchId,
    }
  })

  const { result: slotsResult, loading: loadingSlots } = useServiceSlots({
    input: slotInput,
    candidateResources: allResources,
    allServices,
  })

  // Применить выбранный слот к выбранной услуге.
  // slotChanged-флаг больше не выставляется руками — он derived (см. isSlotChanged
  // в components/appointments/types.ts), считается из current* vs original*.
  const applySlotToSelected = (slot: { startTime: string; endTime: string; resourceId: string }) => {
    const svc = selectedService.value

    if (!svc) return
    svc.currentStartTime = slot.startTime
    svc.currentEndTime = slot.endTime
    svc.currentResourceId = slot.resourceId
  }

  const setPreferredResource = (key: string, resourceId: string | null) => {
    const svc = state.services.find((s) => s._key === key)

    if (!svc) return
    if (svc.preferredResourceId === resourceId) return
    svc.preferredResourceId = resourceId

    // Если выбрали конкретного мастера, отличного от текущего слота —
    // сбрасываем слот, юзер выберет новый. «Любой» (null) совместим с любым
    // текущим resourceId, не сбрасываем.
    if (resourceId !== null && resourceId !== svc.currentResourceId) {
      svc.currentResourceId = null
      svc.currentStartTime = null
      svc.currentEndTime = null
    }

    // Если выбрали этого же мастера для услуги-черновика, ничего не делаем —
    // следующий клик по чипсе всё равно установит slot+resource.
    selectedServiceKey.value = key
  }

  // ─── Service mutations ────────────────────────────────────────────────────
  const preferredResourceHint = ref<string | null>(props.initialPreset?.preferredResourceId ?? null)

  const addService = (svc: ServiceWithBranchIds) => {
    let preferred: string | null = null

    if (preferredResourceHint.value) {
      const compat = competenciesHelper.competencyByResource.value.get(preferredResourceHint.value)

      if (compat?.has(svc.id)) preferred = preferredResourceHint.value
      preferredResourceHint.value = null
    }

    const newService: EditorService = {
      _key: newKey(),
      serviceId: svc.id,
      serviceName: svc.name,
      durationMinutes: svc.duration,
      price: svc.price,
      preferredResourceId: preferred,
      appointmentId: null,
      pendingRemove: false,
      currentResourceId: null,
      currentStartTime: null,
      currentEndTime: null,
      originalResourceId: null,
      originalStartTime: null,
      originalEndTime: null,
    }

    state.services.push(newService)
    // Открываем слот-пикер сразу для новой услуги — юзеру ВСЁ РАВНО надо подобрать слот.
    selectedServiceKey.value = newService._key
  }

  const removeService = (key: string) => {
    const idx = state.services.findIndex((s) => s._key === key)

    if (idx === -1) return
    const svc = state.services[idx]

    if (svc.appointmentId) {
      svc.pendingRemove = true
    } else {
      state.services.splice(idx, 1)
    }
    if (selectedServiceKey.value === key) selectedServiceKey.value = null
  }

  const restoreService = (key: string) => {
    const svc = state.services.find((s) => s._key === key)

    if (svc) svc.pendingRemove = false
  }

  // ─── Per-service validity на выбранный день ──────────────────────────────
  // Гранулярная диагностика — UI отдельно подсвечивает время и мастера и
  // показывает алерт-резюме внутри карточки услуги. Кейсы:
  //   'ok'         — мастер свободен в это время на этот день.
  //   'time-busy'  — мастер работает и доступен в другие слоты, но не в это.
  //                  Подсветка: ВРЕМЯ красным, мастер ок. Можно сменить время.
  //   'master-off' — мастер не работает / весь день занят, но услугу выполнят
  //                  другие. Подсветка: МАСТЕР красным (время бессмысленно
  //                  без мастера → тоже красное). Сменить мастера и/или время.
  //   'all-empty'  — на эту дату услугу никто не сделает (никого нет/все заняты
  //                  весь день). Подсветка: и время, и мастер. Перенос на день.
  type ValidityReason = 'ok' | 'time-busy' | 'master-off' | 'all-empty'
  const validityByKey = ref<Record<string, ValidityReason>>({})
  const groupSlotSearchForValidity = useGroupSlotSearch()
  let validityGen = 0

  const recomputeValidity = async () => {
    const myGen = ++validityGen

    if (!state.date) {
      validityByKey.value = {}

      return
    }
    if (!allResources.value.length || !allServices.value.length) {
      return
    }

    const slotStep = appointmentSettingsStore.settings?.slotStepMinutes ?? 30
    const next: Record<string, ValidityReason> = {}

    const checks = state.services.map(async (svc): Promise<readonly [string, ValidityReason]> => {
      if (svc.pendingRemove || !svc.currentStartTime || !svc.currentEndTime || !svc.currentResourceId) {
        return [svc._key, 'ok'] as const
      }

      const r = await groupSlotSearchForValidity.findSlots({
        date: state.date!,
        branchId: state.branchId,
        slotStepMinutes: slotStep,
        services: [{
          serviceId: svc.serviceId,
          duration: svc.durationMinutes,
          preferredResourceId: svc.currentResourceId,
        }],
        candidateResources: allResources.value,
        allServices: allServices.value,
        excludeAppointmentId: svc.appointmentId,
      })

      if (r.type !== 'slots') return [svc._key, 'all-empty'] as const

      // Никто (даже не preferred) не свободен на эту услугу в этот день.
      if (r.entries.length === 0) return [svc._key, 'all-empty'] as const

      // У текущего мастера это конкретно время свободно?
      const ok = r.entries.some((e) => e.startTime === svc.currentStartTime
        && e.match === 'preferred'
        && e.schedule[0].resourceId === svc.currentResourceId)

      if (ok) return [svc._key, 'ok'] as const

      // У текущего мастера есть хоть один свободный слот в этот день?
      const masterHasAnySlot = r.entries.some((e) => e.match === 'preferred'
        && e.schedule[0].resourceId === svc.currentResourceId)

      return [svc._key, masterHasAnySlot ? 'time-busy' : 'master-off'] as const
    })

    try {
      const results = await Promise.all(checks)

      if (myGen !== validityGen) return
      for (const [k, v] of results) next[k] = v
      validityByKey.value = next
    } catch (e) {
      if (myGen !== validityGen) return
      reportError(e)
    }
  }

  // Триггер: смена даты, филиала, слотов или загрузки ресурсов → пересчёт.
  watch(
    () => `${state.date ?? ''}|${state.branchId ?? ''}|${loadingResources.value}|${state.services
      .filter((s) => !s.pendingRemove)
      .map((s) => `${s._key}:${s.appointmentId ?? ''}:${s.currentResourceId ?? ''}:${s.currentStartTime ?? ''}:${s.currentEndTime ?? ''}`)
      .join('|')}`,
    () => { recomputeValidity() },
  )

  const hasInvalidSlots = computed(() => Object.values(validityByKey.value).some((v) => v !== 'ok'))

  // ─── Save ────────────────────────────────────────────────────────────────
  const { save, saving, canSave } = useEditorSave({
    mode: props.mode,
    state,
    initialVisit: props.initialVisit,
    tz,
    dirty,
    isReadOnly,
    takeSnapshot,
    takeMetaSnapshot,
  })

  // ─── Initial load ────────────────────────────────────────────────────────
  const loadResourceData = async (): Promise<void> => {
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) return
    loadingResources.value = true

    if (!appointmentSettingsStore.settings) {
      appointmentSettingsStore.load().catch(reportError)
    }

    try {
      const [resources, services] = await Promise.all([
        api.resources.list(tenantId),
        api.services.list(tenantId),
      ])

      allResources.value = resources.filter((r) => r.isActive)
      allServices.value = services
      try {
        await competenciesHelper.load(allResources.value, allServices.value)
      } catch (e) {
        reportError(e)
      }
    } catch (e) {
      reportError(e)
      message.error('Не удалось загрузить услуги и исполнителей')
    } finally {
      loadingResources.value = false
    }
  }

  onMounted(async () => {
    if (props.mode === 'edit' && props.initialVisit) {
      if (props.initialVisit.status === 'request') {
        // Оформление заявки: услуги-черновики из requested_services, дата
        // ещё не задана — менеджер выберет в редакторе.
        prefillFromRequestVisit(state, props.initialVisit)
      } else {
        prefillFromVisit(state, props.initialVisit, props.initialAppointments ?? [], tz.value)
        // active-визит: дата фиксирована = business_date визита.
        state.date = props.initialVisit.businessDate
      }
    } else if (props.initialPreset) {
      if (props.initialPreset.date) state.date = props.initialPreset.date
      if (props.initialPreset.branchId) state.branchId = props.initialPreset.branchId
    }
    takeSnapshot()
    await loadResourceData()
  })

  return {
    state, snapshot, dirty, canSave, saving, isReadOnly,
    slotsResult, loadingSlots, loadingResources,
    allResources, allServices,
    competencyByResource: competenciesHelper.competencyByResource,
    resourceOptionsFor, serviceNameById, resourceDisplayName, resourceNameById,
    validityByKey, hasInvalidSlots,
    totals, existingServiceIds, activeServicesCount,
    selectedServiceKey, selectedService,
    addService, removeService, restoreService,
    setPreferredResource, applySlotToSelected,
    save,
    tz,
  }
}
