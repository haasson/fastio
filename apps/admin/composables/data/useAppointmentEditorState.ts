import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useMessage } from '@fastio/ui'
import type {
  Appointment, AppointmentGroup, AppointmentRequest,
  Resource, ServiceWithBranchIds,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useGate } from '~/composables/plan/useGate'
import { useDatabase } from '~/composables/data/useDatabase'
import { useEditorCompetencies } from '~/composables/data/useEditorCompetencies'
import { reportError } from '~/utils/reportError'
import type { EditorService, EditorState } from '~/components/appointments/types'
import { newKey, prefillFromGroup, prefillFromRequest } from '~/composables/data/appointmentEditor/utils'
import { useEditorSnapshot } from '~/composables/data/appointmentEditor/useEditorSnapshot'
import { useEditorSlots } from '~/composables/data/appointmentEditor/useEditorSlots'
import { useEditorSave } from '~/composables/data/appointmentEditor/useEditorSave'

type Props = {
  mode: 'edit' | 'create'
  initialGroup?: AppointmentGroup | null
  initialAppointments?: Appointment[]
  initialRequest?: AppointmentRequest | null
}

/**
 * Главный композабл редактора группы записи. Держит state + computed-deps,
 * делегирует логику в подкомпозаблы:
 *   - `useEditorSnapshot` — dirty/snapshot/slotRequired
 *   - `useEditorSlots`    — debounced поиск слотов через group-slots API
 *   - `useEditorSave`     — saveCreate/saveEdit/handleSaveError
 *
 * Подгружает ресурсы и услуги тенанта в onMounted и собирает competency-карту
 * через `useEditorCompetencies`.
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
  const isClosedStatus = computed(() => {
    const s = props.initialGroup?.status

    return s === 'cancelled' || s === 'done'
  })
  const isReadOnly = computed(() => !canManage.value || isClosedStatus.value)

  const state = reactive<EditorState>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
    branchId: null,
    date: null,
    services: [],
    selectedSlotEntry: null,
  })

  const loadingResources = ref(true)
  const allResources = ref<Resource[]>([])
  const allServices = ref<ServiceWithBranchIds[]>([])

  // ─── Lookups ─────────────────────────────────────────────────────────────────
  const resourcesById = computed(() => Object.fromEntries(allResources.value.map((r) => [r.id, r])))
  const appointmentsById = computed(() => Object.fromEntries((props.initialAppointments ?? []).map((a) => [a.id, a])))

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
    if (svc.preferredResourceId) return resourcesById.value[svc.preferredResourceId]?.name ?? 'Неизвестный исполнитель'

    return 'Любой исполнитель'
  }

  const formatTimeOnly = (iso: string): string => new Intl.DateTimeFormat('ru', {
    timeZone: tz.value, hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))

  const appointmentTimeRange = (appointmentId: string): string => {
    const a = appointmentsById.value[appointmentId]

    if (!a) return ''

    return `${formatTimeOnly(a.startsAt)} — ${formatTimeOnly(a.actualEndsAt ?? a.endsAt)}`
  }

  // ─── Totals + computed flags ─────────────────────────────────────────────────
  const totals = computed(() => {
    const active = state.services.filter((s) => !s.pendingRemove)

    return {
      duration: active.reduce((sum, s) => sum + s.durationMinutes, 0),
      price: active.reduce((sum, s) => sum + s.price, 0),
    }
  })

  const existingServiceIds = computed(() => state.services.filter((s) => !s.pendingRemove).map((s) => s.serviceId))
  const activeServicesCount = computed(() => state.services.filter((s) => !s.pendingRemove).length)

  // ─── Snapshot/dirty ──────────────────────────────────────────────────────────
  const { snapshot, takeSnapshot, dirty, slotRequired } = useEditorSnapshot(state, props.mode)

  // ─── Date as timestamp (для UiDatepicker) ────────────────────────────────────
  const dateTs = computed<number | null>({
    get: () => {
      if (!state.date) return null
      const [y, m, d] = state.date.split('-').map(Number)

      return new Date(y, m - 1, d).getTime()
    },
    set: (ts: number | null) => {
      if (!ts) {
        state.date = null

        return
      }
      const d = new Date(ts)

      state.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    },
  })

  // Когда меняется дата или количество услуг — старый выбранный слот невалиден.
  watch([() => state.date, () => state.services.length], () => {
    state.selectedSlotEntry = null
  })

  // ─── Service list mutations ──────────────────────────────────────────────────
  const addService = (svc: ServiceWithBranchIds) => {
    state.services.push({
      _key: newKey(),
      serviceId: svc.id,
      serviceName: svc.name,
      durationMinutes: svc.duration,
      price: svc.price,
      preferredResourceId: null,
      appointmentId: null,
      pendingRemove: false,
    })
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
  }

  const restoreService = (key: string) => {
    const svc = state.services.find((s) => s._key === key)

    if (svc) svc.pendingRemove = false
  }

  // ─── Slots search (debounced) ────────────────────────────────────────────────
  const { slotsResult, loadingSlots } = useEditorSlots(state, allResources, allServices)

  // ─── Save flow ───────────────────────────────────────────────────────────────
  const { save, saving, canSave } = useEditorSave({
    mode: props.mode,
    state,
    initialGroup: props.initialGroup,
    initialRequest: props.initialRequest,
    tz,
    dirty,
    slotRequired,
    isReadOnly,
    takeSnapshot,
  })

  // ─── Initial load ────────────────────────────────────────────────────────────
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
      // Компетенции — не блокирующий шаг: при ошибке селекты покажут пустой
      // список совместимых ресурсов, но форма останется рабочей.
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
    if (props.mode === 'edit' && props.initialGroup) {
      prefillFromGroup(state, props.initialGroup, props.initialAppointments ?? [], tz.value)
    } else if (props.initialRequest) {
      prefillFromRequest(state, props.initialRequest)
    }
    takeSnapshot()
    await loadResourceData()
  })

  return {
    state, snapshot, dirty, canSave, saving, slotRequired, isClosedStatus, isReadOnly,
    slotsResult, loadingSlots, loadingResources,
    allResources, allServices,
    competencyByResource: competenciesHelper.competencyByResource,
    resourceOptionsFor, serviceNameById, resourceDisplayName, appointmentTimeRange,
    totals, existingServiceIds, activeServicesCount, dateTs,
    addService, removeService, restoreService, save,
    tz,
  }
}
