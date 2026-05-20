import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRouter, useRoute } from '#imports'
import { useMessage } from '@fastio/ui'
import type { Appointment, Visit } from '@fastio/shared'
import { localDateTimeToUtcIso } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { useBranchStore } from '~/shared/stores/branch'
import { reportError } from '@fastio/shared/observability'
import { inheritAppointmentStatus } from './utils'
import type { EditorState } from '../../components/types'
import { isSlotChanged } from '../../components/types'
import { useAppointmentEventLogger } from '../useAppointmentEventLogger'

type SaveDeps = {
  mode: 'create' | 'edit'
  state: EditorState
  initialVisit?: Visit | null
  initialAppointments?: Appointment[]
  serviceNameById?: (id: string) => string | null
  resourceNameById?: (id: string | null) => string | null
  tz: ComputedRef<string>
  dirty: ComputedRef<boolean>
  isReadOnly: ComputedRef<boolean>
  takeSnapshot: () => void
  takeMetaSnapshot: () => void
}

const handleSaveError = (e: unknown, message: ReturnType<typeof useMessage>): void => {
  reportError(e)
  const msg = (e as Error)?.message ?? ''

  if (msg.includes('Slot is taken')) message.error('Один из слотов уже занят. Подберите другое время.')
  else if (msg.includes('Cannot update cancelled appointment') || msg.includes('Cannot update completed appointment')) {
    message.error('Эту услугу уже нельзя редактировать — она закрыта.')
  } else if (msg.includes('бизнес-день')) {
    message.error(msg)
  } else message.error(msg || 'Не удалось сохранить запись')
}

export function useEditorSave(deps: SaveDeps) {
  const router = useRouter()
  const route = useRoute()
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()
  const branchStore = useBranchStore()
  const message = useMessage()
  const logger = useAppointmentEventLogger()

  const saving = ref(false)

  // Все активные услуги обязаны иметь выбранный слот (currentStartTime). Имя
  // и телефон тоже обязательны. Иначе нельзя сохранить.
  const canSave = computed<boolean>(() => {
    if (deps.isReadOnly.value) return false
    if (!deps.state.customerName.trim() || !deps.state.customerPhone.trim()) return false
    if (!deps.state.date) return false

    // В мульти-филиальном тенанте branchId обязателен — иначе визит выпадает
    // из admin sidebar-фильтра (становится «безфилиальным сиротой»).
    if (branchStore.branches.length > 1 && !deps.state.branchId) return false

    const active = deps.state.services.filter((s) => !s.pendingRemove)

    if (active.length === 0) return false

    return active.every((s) => !!s.currentStartTime && !!s.currentEndTime)
  })

  // Create-mode: создаём визит одной транзакцией через create_appointments_bulk.
  // Каждая услуга обязана иметь выбранный currentStartTime/currentEndTime/currentResourceId
  // — иначе canSave=false и сюда не попадаем.
  const saveCreate = async (): Promise<void> => {
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) throw new Error('Тенант не выбран')

    const date = deps.state.date!
    const tzVal = deps.tz.value

    const items = deps.state.services
      .filter((s) => !s.pendingRemove)
      .map((s) => ({
        serviceId: s.serviceId,
        resourceId: s.currentResourceId,
        startsAt: localDateTimeToUtcIso(date, s.currentStartTime!, tzVal),
        endsAt: localDateTimeToUtcIso(date, s.currentEndTime!, tzVal),
        serviceName: s.serviceName,
        servicePrice: s.price,
        resourceAssignedBy: 'admin' as const,
      }))

    const result = await api.visits.createBulk({
      tenantId,
      branchId: deps.state.branchId,
      customerId: null,
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      // Email из админки не редактируется — поле в БД заполнено только если визит
      // пришёл со storefront и customer.email там был.
      customerEmail: null,
      notes: deps.state.notes.trim() || null,
      items,
      autoConfirm: true,
      allowReschedule: false,
      allowCancel: false,
      source: 'admin',
    })

    message.success('Визит создан')

    // Фиксируем snapshot ДО router.push — иначе useUnsavedGuard на текущей
    // странице new.vue решит, что есть несохранённые изменения, и покажет модалку.
    deps.takeSnapshot()

    // Пробрасываем ?from=timeline дальше, чтобы кнопка «Назад» на странице
    // нового визита вернула на таймлайн, а не в общий список.
    const fromQuery = route.query.from === 'timeline' ? { from: 'timeline' } : {}

    await router.push({ path: `/appointments/visits/${result.visitId}`, query: fromQuery })
  }

  // Конверсия request-визита в active: метаданные уже в БД, нужно лишь добавить
  // appointments + сменить status. Делается одним RPC convert_visit_request.
  const saveConvertRequest = async (): Promise<void> => {
    const visit = deps.initialVisit!
    const userId = authStore.user?.id

    if (!userId) throw new Error('Не авторизован')

    const date = deps.state.date!
    const tzVal = deps.tz.value

    const items = deps.state.services
      .filter((s) => !s.pendingRemove)
      .map((s) => ({
        serviceId: s.serviceId,
        resourceId: s.currentResourceId,
        startsAt: localDateTimeToUtcIso(date, s.currentStartTime!, tzVal),
        endsAt: localDateTimeToUtcIso(date, s.currentEndTime!, tzVal),
        serviceName: s.serviceName,
        servicePrice: s.price,
        resourceAssignedBy: 'admin' as const,
      }))

    // Метаданные клиента/филиала могли быть отредактированы — апдейтим до конвертации.
    // Если convertRequest упадёт — мета уже сохранена в БД, поэтому фиксируем
    // partial snapshot чтобы повторный save не дёргал updateMeta зря и юзер видел
    // в state ровно то что лежит в БД (правило feedback_optimistic_updates).
    await api.visits.updateMeta(visit.id, {
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      notes: deps.state.notes.trim() || null,
      branchId: deps.state.branchId,
    })

    deps.takeMetaSnapshot()

    try {
      await api.visits.convertRequest(visit.id, userId, items)
    } catch (e) {
      message.error('Данные клиента сохранены, но создание услуг упало — попробуйте ещё раз')
      throw e
    }

    message.success('Заявка оформлена')
    deps.takeSnapshot()
  }

  // Edit-mode: применяем изменения по типам отдельными RPC. Порядок:
  //   1) отмены помеченных существующих → освобождаем capacity
  //   2) reschedule существующих с slotChanged → применяем новые слоты
  //   3) добавления новых услуг (с выбранным слотом) → INSERT в визит
  // Метаданные визита (имя/телефон/...) — отдельным UPDATE до 1).
  // Каждая операция атомарна, цепочка best-effort: при ошибке уже применённые
  // не откатываются. Юзер увидит сообщение и часть данных в БД будет обновлена.
  const saveEdit = async (): Promise<void> => {
    const visitId = deps.initialVisit!.id
    const date = deps.state.date!
    const tzVal = deps.tz.value

    await api.visits.updateMeta(visitId, {
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      notes: deps.state.notes.trim() || null,
      branchId: deps.state.branchId,
    })

    const toCancel = deps.state.services.filter((s) => s.pendingRemove && s.appointmentId)

    await Promise.all(toCancel.map((svc) => api.appointments.softDelete(
      svc.appointmentId!, 'Изменено в редакторе', 'admin',
    )))

    const toReschedule = deps.state.services.filter((s) => !s.pendingRemove && s.appointmentId && isSlotChanged(s) && s.currentStartTime && s.currentEndTime)

    await Promise.all(toReschedule.map((svc) => api.appointments.reschedule(svc.appointmentId!, {
      resourceId: svc.currentResourceId,
      startsAt: localDateTimeToUtcIso(date, svc.currentStartTime!, tzVal),
      endsAt: localDateTimeToUtcIso(date, svc.currentEndTime!, tzVal),
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
      servicePrice: svc.price,
      // Любая правка мастера/слота через editor — это admin-действие.
      resourceAssignedBy: 'admin',
    })))

    // Новые услуги добавляем последовательно (advisory lock per resource —
    // параллельные INSERT'ы могли бы завершиться двойной записью одного слота
    // без error если pg_advisory_xact_lock запросов не пересекается; перестраховка).
    //
    // Статус новой услуги наследуем от визита (см. inheritAppointmentStatus).
    const inheritedStatus = deps.initialVisit
      ? inheritAppointmentStatus(deps.initialVisit.status)
      : 'new'

    for (const svc of deps.state.services.filter((s) => !s.pendingRemove && !s.appointmentId && s.currentStartTime && s.currentEndTime)) {
      const created = await api.appointments.addToVisit({
        visitId,
        serviceId: svc.serviceId,
        resourceId: svc.currentResourceId,
        startsAt: localDateTimeToUtcIso(date, svc.currentStartTime!, tzVal),
        endsAt: localDateTimeToUtcIso(date, svc.currentEndTime!, tzVal),
        serviceName: svc.serviceName,
        status: inheritedStatus,
        servicePrice: svc.price,
        resourceAssignedBy: 'admin',
      })

      svc.appointmentId = created.id
      // После insert «новый» слот становится original (записан в БД) — синхронизируем
      // снапшот, иначе isSlotChanged будет постоянно true для этой услуги.
      svc.originalResourceId = svc.currentResourceId
      svc.originalStartTime = svc.currentStartTime
      svc.originalEndTime = svc.currentEndTime
    }

    // После reschedule в БД лежит то что в state.current* — обновляем original*.
    for (const svc of toReschedule) {
      svc.originalResourceId = svc.currentResourceId
      svc.originalStartTime = svc.currentStartTime
      svc.originalEndTime = svc.currentEndTime
    }

    deps.state.services = deps.state.services.filter((s) => !s.pendingRemove)
    deps.takeSnapshot()

    // Fire-and-forget: логируем изменения в appointment_events.
    // Мета-поля (имя/телефон/заметки) логируем один раз на первый оставшийся
    // appointment, слот/ресурс — на каждый reschedule отдельно.
    const lookups = {
      serviceName: deps.serviceNameById ?? (() => null),
      resourceName: deps.resourceNameById ?? (() => null),
    }
    const initialAppts = deps.initialAppointments ?? []
    const firstOrigAppt = initialAppts.find(
      (a) => !toCancel.some((tc) => tc.appointmentId === a.id),
    )

    if (firstOrigAppt) {
      logger.logFormDiff(
        {
          serviceId: firstOrigAppt.serviceId,
          resourceId: firstOrigAppt.resourceId,
          customerName: deps.state.customerName.trim(),
          customerPhone: deps.state.customerPhone.trim(),
          notes: deps.state.notes.trim() || null,
          startsAt: firstOrigAppt.startsAt,
          endsAt: firstOrigAppt.endsAt,
        },
        firstOrigAppt,
        lookups,
      )
    }
    for (const svc of toReschedule) {
      const origAppt = initialAppts.find((a) => a.id === svc.appointmentId)

      if (!origAppt) continue
      logger.logFormDiff(
        {
          serviceId: svc.serviceId,
          resourceId: svc.currentResourceId,
          customerName: origAppt.customerName,
          customerPhone: origAppt.customerPhone,
          notes: origAppt.notes,
          startsAt: localDateTimeToUtcIso(date, svc.currentStartTime!, tzVal),
          endsAt: localDateTimeToUtcIso(date, svc.currentEndTime!, tzVal),
        },
        origAppt,
        lookups,
      )
    }
    for (const svc of toCancel) {
      const origAppt = initialAppts.find((a) => a.id === svc.appointmentId)

      if (!origAppt) continue
      logger.logStatusChange(origAppt, origAppt.status, 'cancelled')
    }
  }

  // Edit-mode для request-визита = «Оформить заявку»: ту же кнопку «Сохранить» зовём,
  // но внутри идёт convertRequest вместо обычного diff-save.
  const isRequestMode = computed(() => deps.mode === 'edit' && deps.initialVisit?.status === 'request')

  // «Дата визита изменилась относительно сохранённой». В этом режиме reschedule
  // не подходит (его триггер enforce_visit_business_date упадёт — у визита
  // прежний business_date). Используем move_appointment для каждой услуги:
  // он атомарно создаёт/находит целевой визит на новую дату и перевешивает.
  const isDateMoved = computed(() => deps.mode === 'edit'
    && deps.initialVisit?.status === 'active'
    && !!deps.initialVisit.businessDate
    && deps.state.date !== deps.initialVisit.businessDate)

  // Полный перенос всего визита на другой день — атомарный RPC move_visit_to_date.
  // Соft-deletes для toRemove, RPC для переноса всех existing услуг одной транзакцией,
  // INSERT для новых. При ошибке RPC старый визит остаётся целым (атомарность БД).
  const saveMoveVisitDate = async (): Promise<string | null> => {
    const oldId = deps.initialVisit!.id
    const newDate = deps.state.date!
    const tzVal = deps.tz.value

    await api.visits.updateMeta(oldId, {
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      notes: deps.state.notes.trim() || null,
      branchId: deps.state.branchId,
    })

    // Soft-delete помеченных к удалению — их не двигаем на новую дату.
    const toRemove = deps.state.services.filter((s) => s.pendingRemove && s.appointmentId)

    await Promise.all(toRemove.map((svc) => api.appointments.softDelete(
      svc.appointmentId!, 'Изменено в редакторе', 'admin',
    )))

    // Атомарный перенос на новую дату — RPC сдвигает все активные услуги.
    const remaining = deps.state.services.filter((s) => !s.pendingRemove && s.appointmentId)

    let newVisitId = oldId

    if (remaining.length > 0) {
      const moveResult = await api.visits.moveVisitToDate(
        oldId, newDate, authStore.user?.id ?? null,
      )

      newVisitId = moveResult.newVisitId ?? oldId
    }

    // После переноса даты — slot changes (мастер/время) применяем отдельным reschedule.
    // Это уже не атомарно с move, но в большинстве кейсов юзер меняет только дату.
    const toReschedule = deps.state.services.filter((s) => !s.pendingRemove && s.appointmentId && isSlotChanged(s) && s.currentStartTime && s.currentEndTime)

    await Promise.all(toReschedule.map((svc) => api.appointments.reschedule(svc.appointmentId!, {
      resourceId: svc.currentResourceId,
      startsAt: localDateTimeToUtcIso(newDate, svc.currentStartTime!, tzVal),
      endsAt: localDateTimeToUtcIso(newDate, svc.currentEndTime!, tzVal),
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
      servicePrice: svc.price,
      resourceAssignedBy: 'admin',
    })))

    // Новые услуги (без appointmentId) — добавляем в (возможно новый) визит.
    for (const svc of deps.state.services.filter((s) => !s.pendingRemove && !s.appointmentId && s.currentStartTime && s.currentEndTime)) {
      const created = await api.appointments.addToVisit({
        visitId: newVisitId,
        serviceId: svc.serviceId,
        resourceId: svc.currentResourceId,
        startsAt: localDateTimeToUtcIso(newDate, svc.currentStartTime!, tzVal),
        endsAt: localDateTimeToUtcIso(newDate, svc.currentEndTime!, tzVal),
        serviceName: svc.serviceName,
        servicePrice: svc.price,
        resourceAssignedBy: 'admin',
      })

      svc.appointmentId = created.id
      svc.originalResourceId = svc.currentResourceId
      svc.originalStartTime = svc.currentStartTime
      svc.originalEndTime = svc.currentEndTime
    }

    // После reschedule original* должен совпадать с current* — иначе isSlotChanged
    // всё ещё будет true и при следующем save попробуем reschedule повторно.
    for (const svc of toReschedule) {
      svc.originalResourceId = svc.currentResourceId
      svc.originalStartTime = svc.currentStartTime
      svc.originalEndTime = svc.currentEndTime
    }

    deps.state.services = deps.state.services.filter((s) => !s.pendingRemove)
    deps.takeSnapshot()

    return newVisitId !== oldId ? newVisitId : null
  }

  const save = async (): Promise<boolean> => {
    if (!canSave.value || saving.value) return false
    if (!isRequestMode.value && !deps.dirty.value) return false

    saving.value = true
    try {
      if (deps.mode === 'create') {
        await saveCreate()
      } else if (isRequestMode.value) {
        await saveConvertRequest()
      } else if (isDateMoved.value) {
        const newId = await saveMoveVisitDate()

        message.success('Визит перенесён')
        // id визита мог измениться — переходим на новую страницу с тем же from.
        if (newId) {
          const fromQuery = route.query.from === 'timeline' ? { from: 'timeline' } : {}

          await router.push({ path: `/appointments/visits/${newId}`, query: fromQuery })
        }
      } else {
        await saveEdit()
        message.success('Визит сохранён')
      }

      return true
    } catch (e) {
      handleSaveError(e, message)

      return false
    } finally {
      saving.value = false
    }
  }

  return { save, saving, canSave }
}

export type UseEditorSaveReturn = ReturnType<typeof useEditorSave>
