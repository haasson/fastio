import { ref, reactive, computed, onMounted } from 'vue'
import { useMessage } from '@fastio/ui'
import type { AppointmentRequest, Resource } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useGate } from '~/composables/plan/useGate'
import { useDatabase } from '~/composables/data/useDatabase'
import { useEditorCompetencies } from '~/composables/data/useEditorCompetencies'
import { reportError } from '~/utils/reportError'

type RequestService = {
  serviceId: string
  serviceName: string
  preferredResourceId: string | null
  durationMinutes: number
  price: number
}

type Snapshot = {
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  servicesKey: string
}

type Props = {
  initialRequest: AppointmentRequest
  initialPreferredResources: Resource[]
}

/**
 * Композабл редактора заявки. Симметричен `useAppointmentEditorState` для
 * групп: держит state + dirty/snapshot, грузит ресурсы и компетенции, делает
 * save через `appointmentRequestsApi.updateMeta`. Возвращает `success: boolean`
 * из save() чтобы родителю не приходилось гадать через сравнение dirty.
 */
export function useAppointmentRequestEditorState(props: Props) {
  const api = useDatabase()
  const gate = useGate()
  const tenantStore = useTenantStore()
  const message = useMessage()
  const competenciesHelper = useEditorCompetencies()

  const canManage = computed(() => gate.manageAppointments.value.enabled)
  const isClosedStatus = computed(() => props.initialRequest.status === 'converted'
    || props.initialRequest.status === 'declined')
  const isReadOnly = computed(() => !canManage.value || isClosedStatus.value)

  const state = reactive({
    customerName: props.initialRequest.customerName,
    customerPhone: props.initialRequest.customerPhone,
    customerEmail: props.initialRequest.customerEmail ?? '',
    notes: props.initialRequest.notes ?? '',
    services: props.initialRequest.services.map((s): RequestService => ({ ...s })),
  })

  const loadingResources = ref(true)
  const allResources = ref<Resource[]>([])

  const preferredResourcesById = computed(() => Object.fromEntries([
    ...props.initialPreferredResources.map((r) => [r.id, r] as const),
    ...allResources.value.map((r) => [r.id, r] as const),
  ]))

  const resourceOptionsFor = (serviceId: string) => {
    const map = competenciesHelper.competencyByResource.value

    return allResources.value
      .filter((r) => map.get(r.id)?.has(serviceId))
      .map((r) => ({ label: r.name, value: r.id }))
  }

  const preferredResourceName = (resourceId: string): string => preferredResourcesById.value[resourceId]?.name ?? 'Неизвестный'

  const totalDuration = computed(() => state.services.reduce((acc, s) => acc + s.durationMinutes, 0))
  const totalPrice = computed(() => state.services.reduce((acc, s) => acc + s.price, 0))

  // ─── Snapshot / dirty ───────────────────────────────────────────────────────
  const buildServicesKey = (): string => JSON.stringify(state.services.map((s) => ({
    serviceId: s.serviceId,
    preferredResourceId: s.preferredResourceId,
  })))

  const snapshot: Snapshot = {
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    notes: state.notes,
    servicesKey: buildServicesKey(),
  }

  const dirty = computed(() => state.customerName !== snapshot.customerName
    || state.customerPhone !== snapshot.customerPhone
    || state.customerEmail !== snapshot.customerEmail
    || state.notes !== snapshot.notes
    || buildServicesKey() !== snapshot.servicesKey)

  const canSave = computed(() => !isReadOnly.value
    && !!state.customerName.trim()
    && !!state.customerPhone.trim())

  // ─── Initial load ───────────────────────────────────────────────────────────
  onMounted(async () => {
    if (isReadOnly.value) {
      loadingResources.value = false

      return
    }
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) {
      loadingResources.value = false

      return
    }

    try {
      const [resources, services] = await Promise.all([
        api.resources.list(tenantId),
        api.services.list(tenantId),
      ])

      allResources.value = resources.filter((r) => r.isActive)
      // Компетенции — не блокирующий шаг: при ошибке селекты покажут пустой
      // список совместимых ресурсов, но форма останется рабочей.
      try {
        await competenciesHelper.load(allResources.value, services)
      } catch (e) {
        reportError(e)
      }
    } catch (e) {
      reportError(e)
      message.error('Не удалось загрузить исполнителей')
    } finally {
      loadingResources.value = false
    }
  })

  // ─── Save ───────────────────────────────────────────────────────────────────
  const saving = ref(false)

  const save = async (): Promise<boolean> => {
    if (!dirty.value || !canSave.value || saving.value) return false

    saving.value = true
    try {
      await api.appointmentRequests.updateMeta(props.initialRequest.id, {
        customerName: state.customerName.trim(),
        customerPhone: state.customerPhone.trim(),
        customerEmail: state.customerEmail.trim() || null,
        notes: state.notes.trim() || null,
        services: state.services.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          preferredResourceId: s.preferredResourceId,
          durationMinutes: s.durationMinutes,
          price: s.price,
        })),
      })
      message.success('Заявка сохранена')

      return true
    } catch (e) {
      reportError(e)
      message.error('Не удалось сохранить заявку')

      return false
    } finally {
      saving.value = false
    }
  }

  return {
    state,
    isReadOnly, isClosedStatus,
    loadingResources, allResources,
    resourceOptionsFor, preferredResourceName,
    totalDuration, totalPrice,
    dirty, canSave, saving, save,
  }
}
