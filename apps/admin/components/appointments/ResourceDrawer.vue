<template>
  <UiDrawer
    :model-value="modelValue"
    :title="drawerTitle"
    :width="520"
    :actions="drawerActions"
    :on-confirm="onSave"
    :on-decline="() => true"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div :key="formKey" class="content">
      <UiForm ref="formRef">
        <UiSelect
          v-if="type === 'person'"
          v-model:value="form.memberId"
          name="memberId"
          label="Сотрудник"
          :options="memberOptions"
          placeholder="Выберите из команды"
          :rules="[{ type: 'required', message: 'Выберите сотрудника' }]"
        />

        <UiInput
          v-if="type === 'object'"
          v-model="form.name"
          label="Название"
          name="name"
          :rules="[{ type: 'required', message: 'Укажите название' }]"
        />

        <UiInputNumber
          v-if="type === 'object'"
          v-model="form.capacity"
          label="Количество одновременных бронирований"
          :min="1"
          :max="999"
          :show-button="false"
          message="Например, 10 бильярдных столов = 10"
        />

        <UiSelect
          v-if="showBranchField"
          v-model:value="form.branchId"
          name="branchId"
          label="Филиал"
          :options="branchOptions"
          placeholder="Выберите филиал"
          :rules="[{ type: 'required', message: 'Выберите филиал' }]"
        />

        <UiSelect
          v-model:value="form.categoryIds"
          name="categoryIds"
          label="Категории целиком"
          :options="categoryOptions"
          multiple
          placeholder="Не выбрано"
          message="Все услуги в этих категориях привяжутся автоматически. Новые тоже."
          :rules="serviceLinkRules"
        />

        <UiSelect
          v-model:value="form.serviceIds"
          name="serviceIds"
          label="Отдельные услуги"
          :options="serviceOptions"
          multiple
          placeholder="Выберите услуги"
          filterable
        />
      </UiForm>

      <!-- Schedule via template -->
      <div class="schedule-section">
        <UiTitle size="h5">График работы</UiTitle>

        <UiSkeleton v-if="templatesLoading" :repeat="1" />

        <UiAlert v-else-if="!allTemplates.length" type="info" size="small">
          Сначала создайте шаблон графика в разделе «Шаблоны».
        </UiAlert>

        <template v-else>
          <UiSelect
            v-model:value="form.templateId"
            name="templateId"
            label="Шаблон"
            :options="templateOptions"
            placeholder="Не выбран"
            :rules="!resource ? [{ required: true, message: 'Выберите шаблон графика' }] : []"
          />

          <UiDatepicker
            v-if="selectedTemplate?.type === 'shift'"
            v-model="applyStartTs"
            label="Старт цикла"
            size="small"
            message="Дальше шаблон повторяется по кругу"
          />

          <UiAlert v-if="form.templateId && resource" type="info" size="small">
            После сохранения шаблон заменит текущий график. Периоды отсутствий не затронутся.
          </UiAlert>
        </template>
      </div>

      <!-- Date overrides — периоды отсутствия (отпуск, болезнь). Без времени, всегда выходной. -->
      <div v-if="resource" class="schedule-section">
        <UiTitle size="h5">Отпуска и отсутствия</UiTitle>

        <UiAlert
          v-for="period in currentOffPeriods"
          :key="`current-${period.from}`"
          type="warning"
          size="small"
          class="off-current"
        >
          <div class="off-current-row">
            <span><strong>Сейчас отсутствует:</strong> {{ formatPeriod(period) }} ({{ periodDaysLabel(period) }})</span>
            <div class="off-current-actions">
              <UiButton
                size="tiny"
                type="text"
                icon="edit"
                :disabled="editingPeriod !== null"
                @click="startEdit(period)"
              />
              <UiButton
                size="tiny"
                type="text"
                icon="trash"
                :disabled="editingPeriod !== null"
                @click="removeOffPeriod(period)"
              />
            </div>
          </div>
        </UiAlert>

        <div v-if="futureOffPeriods.length" class="overrides-list">
          <UiText size="small" weight="medium" class="overrides-label">Запланировано</UiText>
          <div
            v-for="period in futureOffPeriods"
            :key="period.from"
            class="override-row"
          >
            <div class="override-info">
              <UiText size="small" weight="medium">{{ formatPeriod(period) }}</UiText>
              <UiText size="tiny" class="hint">{{ periodDaysLabel(period) }}</UiText>
            </div>
            <div class="override-actions">
              <UiButton
                size="tiny"
                type="text"
                icon="edit"
                :disabled="editingPeriod !== null"
                @click="startEdit(period)"
              />
              <UiButton
                size="tiny"
                type="text"
                icon="trash"
                :disabled="editingPeriod !== null"
                @click="removeOffPeriod(period)"
              />
            </div>
          </div>
        </div>

        <div class="overrides-form">
          <UiDatepicker
            v-model="offForm.from"
            placeholder="С"
            size="small"
            class="override-date"
            :is-date-disabled="isDateBeforeToday"
          />
          <span class="time-sep">—</span>
          <UiDatepicker
            v-model="offForm.to"
            placeholder="По"
            size="small"
            class="override-date"
            :is-date-disabled="isDateBeforeToday"
          />
          <UiButton
            size="small"
            type="primary"
            :disabled="!canAddOff"
            @click="addOffPeriod"
          >
            {{ editingPeriod ? 'Сохранить' : 'Добавить' }}
          </UiButton>
          <UiButton
            v-if="editingPeriod"
            size="small"
            type="text"
            @click="cancelEdit"
          >
            Отмена
          </UiButton>
        </div>
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiInput, UiSelect, UiTitle, UiText, UiButton, UiAlert, UiDatepicker, UiInputNumber, UiSkeleton, useConfirm, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Resource, ResourceDateOverride, Service, Category, ScheduleTemplate, ResourceType } from '@fastio/shared'
import { pluralize, utcIsoToLocalDateTime, localDateTimeToUtcIso, todayInTz, addDaysToDateStr } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTeam } from '~/composables/data/useTeam'
import { useScheduleConflictCheck } from '~/composables/data/useScheduleConflictCheck'
import {
  buildSlotDataFromWeeklyTemplate, buildSlotDataFromShiftTemplate,
} from '~/utils/scheduleConflictCheck'
import { reportError } from '~/utils/reportError'

const props = defineProps<{
  modelValue: boolean
  resource: Resource | null
  type: ResourceType
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'saved': []
}>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()
const { members: teamMembers, load: loadTeam } = useTeam()
const { findConflicts } = useScheduleConflictCheck()

const formRef = ref<{ validate: () => Promise<boolean> } | null>(null)
const saving = ref(false)

// Перемонтируем содержимое дровера при каждом открытии, чтобы FormItem'ы
// не наследовали touched/error от прошлой сессии.
const formKey = ref(0)

const drawerTitle = computed(() => {
  if (props.type === 'person') return props.resource ? 'Редактировать сотрудника' : 'Новый сотрудник'

  return props.resource ? 'Редактировать объект' : 'Новый объект'
})

const form = reactive({
  name: '',
  memberId: null as string | null,
  capacity: 1 as number,
  branchId: null as string | null,
  serviceIds: [] as string[],
  categoryIds: [] as string[],
  templateId: null as string | null,
})

const applyStartTs = ref<number>(Date.now())
const dateOverrides = ref<ResourceDateOverride[]>([])
const services = ref<Service[]>([])
const categories = ref<Category[]>([])
const allTemplates = ref<ScheduleTemplate[]>([])
const templatesLoading = ref(true)

const showBranchField = computed(() => branchStore.branches.length > 1)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })),
)

// В исполнители записи может попасть любой member команды — это про назначение
// в запись, а не про права админить раздел (тот, кто открыл этот дровер, уже
// прошёл гейт manageAppointments).
const memberOptions = computed(() => teamMembers.value.map((m) => ({ label: m.displayName || m.email || m.id, value: m.id })),
)

const serviceOptions = computed(() => services.value.filter((s) => s.isBookable).map((s) => ({ label: s.name, value: s.id })),
)

const categoryOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.id })),
)

const templateOptions = computed(() => allTemplates.value.map((t) => ({
  label: t.type === 'shift' ? `${t.name} (цикл ${t.cycleLength} дн.)` : t.name,
  value: t.id,
})),
)

const selectedTemplate = computed<ScheduleTemplate | null>(() => allTemplates.value.find((t) => t.id === form.templateId) ?? null,
)

const hasAnyServiceLink = computed(() => form.categoryIds.length > 0 || form.serviceIds.length > 0)

// Правило в отдельном computed — внутри `:rules=` arrow-функция может пойти
// через template-proxy, и `hasAnyServiceLink` без `.value` либо ломает типы,
// либо ловит ref-объект (всегда truthy). Здесь validator честно тянет
// `hasAnyServiceLink.value` из script-области.
const serviceLinkRules = computed(() => [{
  type: 'custom' as const,
  validator: () => hasAnyServiceLink.value,
  message: 'Выберите хотя бы одну услугу или категорию',
}])

// ─── Off periods (выходные / отпуск) ──────────────────────
// Хранятся как resource_date_overrides с is_working=false на каждую дату.
// Группируем подряд идущие даты в периоды для UI.

type OffPeriod = { from: string; to: string }

const offForm = reactive({
  from: null as number | null,
  to: null as number | null,
})

// Дата timestamp'а В ТАЙМЗОНЕ ТЕНАНТА. `.toISOString().slice(0,10)` сдвигает
// на сутки около полуночи для тенантов с большим offset (Asia/Tokyo,
// Pacific/Auckland) — поэтому идём через утилиту, опирающуюся на Intl.DateTimeFormat.
const tsToDateStr = (ts: number | null): string | null => {
  if (!ts) return null

  return utcIsoToLocalDateTime(new Date(ts).toISOString(), tenantStore.tenant.timezone).dateStr
}

const formatDateRu = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)

  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

const formatPeriod = (p: OffPeriod): string => p.from === p.to ? formatDateRu(p.from) : `${formatDateRu(p.from)} — ${formatDateRu(p.to)}`

// Сравнение по локальному дню браузера админа: то, что админ видит как
// «сегодня» в пикере, и есть «сегодня». Кросс-tz нюансы (тенант vs админ)
// здесь не критичны — выходные дни про календарные числа, а не про время.
const startOfLocalDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const todayStr = (): string => todayInTz(tenantStore.tenant.timezone)

const isDateBeforeToday = (ts: number): boolean => startOfLocalDay(new Date(ts)) < startOfLocalDay(new Date())

type PeriodState = 'past' | 'current' | 'future'

const periodState = (p: OffPeriod): PeriodState => {
  const t = todayStr()

  if (p.to < t) return 'past'
  if (p.from > t) return 'future'

  return 'current'
}

const periodDaysLabel = (p: OffPeriod): string => {
  const from = new Date(p.from + 'T00:00:00').getTime()
  const to = new Date(p.to + 'T00:00:00').getTime()
  const days = Math.round((to - from) / 86_400_000) + 1

  return `${days} дн.`
}

const offPeriods = computed<OffPeriod[]>(() => {
  const offDates = dateOverrides.value
    .filter((o) => !o.isWorking)
    .map((o) => o.date)
    .sort()

  if (!offDates.length) return []

  const nextDay = (date: string): string => addDaysToDateStr(date, 1)

  const periods: OffPeriod[] = []
  let from = offDates[0]
  let prev = offDates[0]

  for (let i = 1; i < offDates.length; i++) {
    const cur = offDates[i]

    if (cur === nextDay(prev)) {
      prev = cur
    } else {
      periods.push({ from, to: prev })
      from = cur
      prev = cur
    }
  }
  periods.push({ from, to: prev })

  // Сортировка: текущие → будущие (по дате старта) → прошедшие (свежие сверху).
  const order: Record<PeriodState, number> = { current: 0, future: 1, past: 2 }

  return periods.sort((a, b) => {
    const sa = periodState(a)
    const sb = periodState(b)

    if (sa !== sb) return order[sa] - order[sb]
    if (sa === 'past') return b.from.localeCompare(a.from) // свежие прошлые сверху

    return a.from.localeCompare(b.from)
  })
})

const canAddOff = computed(() => {
  if (!offForm.from) return false
  const to = offForm.to ?? offForm.from

  return to >= offForm.from
})

const datesInRange = (from: string, to: string): string[] => {
  const result: string[] = []
  let cur = from

  while (cur <= to) {
    result.push(cur)
    cur = addDaysToDateStr(cur, 1)
  }

  return result
}

const addOffPeriod = async () => {
  if (!props.resource || !offForm.from) return
  const fromStr = tsToDateStr(offForm.from)
  const toStr = tsToDateStr(offForm.to ?? offForm.from)

  if (!fromStr || !toStr) return

  // Проверяем активные записи в этом периоде — нельзя молча оставить их
  // на сотруднике, который в отпуске. Границы окна — полночь дня в tz тенанта,
  // не UTC: иначе для тенантов с большим offset запрос сдвинется на сутки.
  const tz = tenantStore.tenant.timezone
  const fromUtc = localDateTimeToUtcIso(fromStr, '00:00', tz)
  const toUtcExclusive = localDateTimeToUtcIso(addDaysToDateStr(toStr, 1), '00:00', tz)

  const conflicts = await api.appointments.listPaginated(tenantStore.currentTenantId!, {
    resourceId: props.resource.id,
    statuses: ['new', 'confirmed'],
    dateFrom: fromUtc,
    dateTo: toUtcExclusive,
    page: 1,
    pageSize: 50,
    sortDir: 'asc',
  })

  if (conflicts.total > 0) {
    const fmt = new Intl.DateTimeFormat('ru', {
      timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    const preview = conflicts.data.slice(0, 3)
      .map((a) => `${fmt.format(new Date(a.startsAt))} — ${a.customerName}`)
      .join('; ')
    const more = conflicts.total > 3 ? ` и ещё ${conflicts.total - 3}` : ''

    await confirm({
      title: `В этот период ${conflicts.total} ${pluralize(conflicts.total, 'запись', 'записи', 'записей')}`,
      message: 'Сначала перенесите их на другого исполнителя или другое время, потом ставьте отсутствие.',
      alert: `${preview}${more}`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  try {
    if (editingPeriod.value) {
      await Promise.all(
        datesInRange(editingPeriod.value.from, editingPeriod.value.to)
          .map((date) => api.resources.removeDateOverride(props.resource!.id, date)),
      )
    }

    await Promise.all(
      datesInRange(fromStr, toStr)
        .map((date) => api.resources.upsertDateOverride(props.resource!.id, date, false, null, null)),
    )
    await loadDateOverrides()
    editingPeriod.value = null
    offForm.from = null
    offForm.to = null
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить отсутствие')
    await loadDateOverrides()
  }
}

const removeOffPeriod = async (period: OffPeriod) => {
  if (!props.resource) return

  const ok = await confirm({
    title: 'Отменить отсутствие?',
    message: `${formatPeriod(period)} — ${periodDaysLabel(period)}`,
    confirmText: 'Отменить',
    cancelText: 'Не отменять',
  })

  if (!ok) return

  await Promise.all(
    datesInRange(period.from, period.to)
      .map((date) => api.resources.removeDateOverride(props.resource!.id, date)),
  )
  await loadDateOverrides()
}

const editingPeriod = ref<OffPeriod | null>(null)

const tsFromDateStr = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number)

  return new Date(y, m - 1, d).getTime()
}

const startEdit = (period: OffPeriod) => {
  editingPeriod.value = period
  offForm.from = tsFromDateStr(period.from)
  offForm.to = tsFromDateStr(period.to)
}

const cancelEdit = () => {
  editingPeriod.value = null
  offForm.from = null
  offForm.to = null
}

const currentOffPeriods = computed(() => offPeriods.value.filter((p) => periodState(p) === 'current'),
)

const futureOffPeriods = computed(() => offPeriods.value.filter((p) => periodState(p) === 'future'),
)

const loadDateOverrides = async () => {
  if (!props.resource) return
  dateOverrides.value = await api.resources.getDateOverrides(props.resource.id)
}

// ─── Apply template ───────────────────────────────────────

const applyTemplate = async (resourceId: string) => {
  if (!form.templateId) return
  const tpl = selectedTemplate.value

  if (!tpl) return

  if (tpl.type === 'weekly') {
    await api.scheduleTemplates.applyWeeklyToResource(form.templateId, resourceId)
  } else {
    const startDate = tsToDateStr(applyStartTs.value)

    if (!startDate) return

    await api.scheduleTemplates.applyShiftToResource(
      form.templateId, resourceId,
      { startDate },
    )
  }
}

// ─── Init ─────────────────────────────────────────────────

const applyResource = async (resource: Resource) => {
  form.name = resource.name
  form.memberId = resource.memberId
  form.capacity = resource.capacity

  const [branchIds, serviceIds, categoryIds, overrides] = await Promise.all([
    api.resources.getBranchIds(resource.id),
    api.resources.getServiceIds(resource.id),
    api.resources.getCategoryIds(resource.id),
    api.resources.getDateOverrides(resource.id),
  ])

  form.branchId = branchIds[0] ?? null
  form.serviceIds = serviceIds
  form.categoryIds = categoryIds
  dateOverrides.value = overrides
}

watch(() => props.modelValue, async (open) => {
  if (!open) return
  formKey.value++
  templatesLoading.value = true
  const tid = tenantStore.currentTenantId

  if (!tid) return

  await loadTeam()

  const [svcList, catList, tplList] = await Promise.all([
    api.services.listActive(tid),
    api.categories.list(tid, 'service'),
    api.scheduleTemplates.list(tid),
  ])

  services.value = svcList
  categories.value = catList
  allTemplates.value = tplList
  templatesLoading.value = false

  if (props.resource) {
    await applyResource(props.resource)
  } else {
    Object.assign(form, {
      name: '', memberId: null, capacity: 1,
      branchId: branchStore.branches.length === 1 ? branchStore.branches[0]!.id : null,
      serviceIds: [], categoryIds: [],
      templateId: null,
    })
    applyStartTs.value = Date.now()
    dateOverrides.value = []
  }
})

// Если стало 1 филиала — авто-привязка.
watch(() => branchStore.branches.length, (n) => {
  if (n === 1 && !form.branchId) {
    form.branchId = branchStore.branches[0]!.id
  }
})

const validateTemplateApply = async (): Promise<boolean> => {
  if (!props.resource || !form.templateId) return true

  const tid = tenantStore.currentTenantId

  if (!tid) return true

  const tpl = await api.scheduleTemplates.getFull(form.templateId)

  if (!tpl) return true

  const horizonStart = todayInTz(tenantStore.tenant.timezone)
  const horizonEnd = addDaysToDateStr(horizonStart, 365)

  const [overrides, dateDisabled, settings] = await Promise.all([
    api.resources.getDateOverridesRange(props.resource.id, horizonStart, horizonEnd),
    api.resources.getDateDisabledSlotsRange(props.resource.id, horizonStart, horizonEnd),
    api.appointmentSettings.get(tid),
  ])

  // branchSchedule с учётом, возможно, нового выбора филиала (effectiveBranchId
  // может отличаться от привязки в БД).
  const effectiveBranchId = form.branchId
    ?? (branchStore.branches.length === 1 ? branchStore.branches[0]!.id : null)
  const branchSchedule = effectiveBranchId
    ? (branchStore.branches.find((b) => b.id === effectiveBranchId)?.workingHoursSchedule
      ?? tenantStore.maybeTenant?.workingHoursSchedule
      ?? null)
    : (tenantStore.maybeTenant?.workingHoursSchedule ?? null)

  const slotData = tpl.type === 'shift'
    ? buildSlotDataFromShiftTemplate(
        tpl,
        tsToDateStr(applyStartTs.value) ?? horizonStart,
        branchSchedule,
        overrides,
        dateDisabled,
      )
    : buildSlotDataFromWeeklyTemplate(
        tpl,
        branchSchedule,
        settings?.slotStepMinutes ?? 30,
        overrides,
        dateDisabled,
      )

  const conflicts = await findConflicts([{ id: props.resource.id, name: props.resource.name, slotData }])

  if (conflicts.length === 0) return true

  const tz = tenantStore.tenant.timezone
  const fmt = new Intl.DateTimeFormat('ru', {
    timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const preview = conflicts.slice(0, 3)
    .map((c) => `${fmt.format(new Date(c.appointment.startsAt))} — ${c.appointment.customerName}`)
    .join('; ')
  const more = conflicts.length > 3 ? ` и ещё ${conflicts.length - 3}` : ''

  await confirm({
    title: `${conflicts.length} ${pluralize(conflicts.length, 'запись', 'записи', 'записей')} попадёт вне расписания`,
    message: 'Сначала отмените или перенесите конфликтующие записи, затем меняйте график.',
    alert: `${preview}${more}`,
    confirmText: false,
    cancelText: 'Понятно',
  })

  return false
}

const onSave = async () => {
  const valid = await formRef.value?.validate()

  if (!valid) return false

  if (!await validateTemplateApply()) return false

  saving.value = true
  const tid = tenantStore.currentTenantId

  if (!tid) return false

  try {
    const isCreate = !props.resource

    // Для person имя — это displayName сотрудника из профиля.
    // Для object — то, что админ ввёл в форме.
    const name = props.type === 'person'
      ? (teamMembers.value.find((m) => m.id === form.memberId)?.displayName ?? '').trim()
      : form.name.trim()

    // Если филиал один — авто-привязка, даже если поле скрыто.
    const effectiveBranchId = form.branchId
      ?? (branchStore.branches.length === 1 ? branchStore.branches[0]!.id : null)
    const branchIds = effectiveBranchId ? [effectiveBranchId] : []

    const resource = props.resource
      ? await api.resources.update(props.resource.id, {
          name,
          type: props.type,
          memberId: props.type === 'person' ? form.memberId : null,
          capacity: props.type === 'object' ? Number(form.capacity) : 1,
        })
      : await api.resources.create(tid, {
          name,
          type: props.type,
          memberId: props.type === 'person' ? form.memberId : null,
          capacity: props.type === 'object' ? Number(form.capacity) : 1,
        })

    await Promise.all([
      api.resources.setBranchIds(resource.id, branchIds),
      api.resources.setServiceIds(resource.id, form.serviceIds),
      api.resources.setCategoryIds(resource.id, form.categoryIds),
    ])

    // Шаблон применяется при сохранении: для нового ресурса — обязательный
    // (валидация на required), для существующего — только если выбран
    // (мы не трекаем «текущий шаблон», поэтому при загрузке он null).
    if (form.templateId) {
      await applyTemplate(resource.id)
      // Перечитаем overrides — applyShift может добавить date_overrides.
      if (!isCreate) await loadDateOverrides()
    }

    emit('saved')

    return true
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить ресурс')

    return false
  } finally {
    saving.value = false
  }
}

const drawerActions: DrawerAction[] = [
  { text: 'Сохранить', type: 'primary', actionType: 'confirm' },
  { text: 'Отмена', type: 'default', actionType: 'decline' },
]
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
}

.schedule-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.hint {
  color: var(--color-text-secondary);
}

.day-off {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.time-input {
  width: 100px;
}

.time-sep {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.overrides-form {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.override-date {
  width: 140px;
}

.overrides-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.override-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-8);
  border-radius: var(--radius-8);
  background: var(--color-bg-subtle);
}

.override-info {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
  min-width: 0;
}

.override-actions {
  display: flex;
  gap: var(--space-4);
}

.overrides-label {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

.off-current {
  margin-bottom: var(--space-4);
}

.off-current-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.off-current-actions {
  display: flex;
  gap: var(--space-4);
  flex-shrink: 0;
}
</style>
