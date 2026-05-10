<template>
  <UiDrawer
    :model-value="modelValue"
    :title="template ? 'Редактировать шаблон' : 'Новый шаблон'"
    :width="560"
    :actions="drawerActions"
    :on-confirm="onSave"
    :on-decline="() => true"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div :key="formKey" class="content">
      <UiForm ref="formRef">
        <UiInput
          v-model="form.name"
          label="Название"
          name="name"
          placeholder="Утро / 2 через 2"
          :rules="[{ type: 'required', message: 'Укажите название' }]"
        />

        <UiSelect
          v-model:value="form.type"
          label="Тип"
          :options="typeOptions"
        />

        <UiSelect
          v-if="branchSelectorOptions.length > 1"
          v-model:value="form.referenceBranchId"
          label="Филиал"
          :options="branchSelectorOptions"
          message="Часы филиала используются для подсказки дефолтов"
        />
      </UiForm>

      <!-- Weekly -->
      <div v-if="form.type === 'weekly'" class="days">
        <div v-for="day in DAYS" :key="day.value" class="day-block">
          <div class="day-head">
            <UiText weight="medium">{{ day.label }}</UiText>
            <UiCheckbox
              :model-value="!isDayWorking(day.value)"
              @update:model-value="(v) => toggleDayOff(day.value, v)"
            >
              Выходной
            </UiCheckbox>
            <UiButton
              v-if="day.value === firstWorkingDow"
              size="tiny"
              type="text"
              icon="copy"
              @click="copyFirstWorkingDayToOthers"
            >
              Скопировать в остальные
            </UiButton>
          </div>
          <div v-if="isDayWorking(day.value)" class="hours-row">
            <UiTimepicker
              v-model="form.dayHours[day.value]!.openTime"
              label="Открытие"
            />
            <UiTimepicker
              v-model="form.dayHours[day.value]!.closeTime"
              label="Закрытие"
            />
          </div>
        </div>
      </div>

      <!-- Shift -->
      <div v-else class="shift">
        <div class="shift-head">
          <UiInputNumber
            v-model="form.cycleLength"
            label="Длина цикла (дней)"
            :min="1"
            :max="30"
            :show-button="false"
            size="small"
          />
        </div>
        <UiText size="tiny" class="hint">
          Дату старта цикла задаёте на сотруднике при применении шаблона.
        </UiText>
        <div class="days">
          <div v-for="i in cycleIndices" :key="i" class="day-block">
            <div class="day-head">
              <UiText weight="medium">День {{ i + 1 }}</UiText>
              <UiCheckbox
                :model-value="!isDayWorking(i)"
                @update:model-value="(v) => toggleDayOff(i, v)"
              >
                Выходной
              </UiCheckbox>
              <UiButton
                v-if="i === firstWorkingShiftDay"
                size="tiny"
                type="text"
                icon="copy"
                @click="copyFirstWorkingDayToOthers"
              >
                Скопировать в остальные
              </UiButton>
            </div>
            <div v-if="isDayWorking(i)" class="hours-row">
              <UiTimepicker
                v-model="form.dayHours[i]!.openTime"
                label="Открытие"
              />
              <UiTimepicker
                v-model="form.dayHours[i]!.closeTime"
                label="Закрытие"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import {
  UiDrawer, UiForm, UiInput, UiSelect, UiInputNumber, UiButton, UiText, UiCheckbox,
  UiTimepicker,
  useConfirm, useMessage,
} from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type {
  ScheduleTemplate, ScheduleTemplateDay, ScheduleTemplateType,
  Branch, WorkingHoursSchedule, Resource,
} from '@fastio/shared'
import { getBranchHoursForDow, pluralize } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useScheduleConflictCheck } from '../composables/useScheduleConflictCheck'
import {
  buildSlotDataFromWeeklyTemplate, buildSlotDataFromShiftTemplate,
} from '../utils/scheduleConflictCheck'
import { reportError } from '~/shared/utils/reportError'

const props = defineProps<{
  modelValue: boolean
  template: ScheduleTemplate | null
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
const { findConflicts } = useScheduleConflictCheck()
const formRef = ref<{ validate: () => Promise<boolean> } | null>(null)

// Перемонтируем содержимое дровера при каждом открытии — иначе FormItem'ы
// сохраняют старый touched/error между сессиями (UiDrawer не размонтирует
// детей на закрытии).
const formKey = ref(0)

const DAYS = [
  { label: 'Пн', value: 1 }, { label: 'Вт', value: 2 }, { label: 'Ср', value: 3 },
  { label: 'Чт', value: 4 }, { label: 'Пт', value: 5 }, { label: 'Сб', value: 6 },
  { label: 'Вс', value: 0 },
]

const typeOptions = [
  { label: 'По дням недели', value: 'weekly' },
  { label: 'Сменный цикл', value: 'shift' },
]

type DayHours = { isWorking: boolean; openTime: string; closeTime: string }

type Form = {
  name: string
  type: ScheduleTemplateType
  cycleLength: number | null
  referenceBranchId: string | null
  /** dayIndex (0..6 для weekly, 0..cycleLength-1 для shift) → часы дня. */
  dayHours: Record<number, DayHours>
}

const form = reactive<Form>({
  name: '',
  type: 'weekly',
  cycleLength: 4,
  referenceBranchId: null,
  dayHours: {},
})

// Флаг блокирует watch на смене type/cycleLength во время загрузки сохранённого
// шаблона: иначе watch сбросит form.dayHours на дефолт.
const applyingTemplate = ref(false)

// Используем загруженные стором филиалы — они уже инициализированы layout-ом
// до открытия редактора шаблонов.
const branches = computed<Branch[]>(() => branchStore.branches as Branch[])

const branchSelectorOptions = computed(() => {
  if (branches.value.length <= 1) return []
  const first = JSON.stringify(branches.value[0]?.workingHoursSchedule ?? null)
  const allSame = branches.value.every((b) => JSON.stringify(b.workingHoursSchedule ?? null) === first)

  if (allSame) return []

  return branches.value.map((b) => ({ label: b.name, value: b.id }))
})

const referenceBranch = computed<Branch | null>(() => {
  if (form.referenceBranchId) {
    return branches.value.find((b) => b.id === form.referenceBranchId) ?? branches.value[0] ?? null
  }

  return branches.value[0] ?? null
})

// Приоритет: график филиала → график тенанта.
// tenant.workingHoursSchedule с миграции 250 не бывает null (server-side
// DEFAULT 10-22 в БД), так что цепочка всегда даёт schedule.
const referenceSchedule = computed<WorkingHoursSchedule | null>(() => referenceBranch.value?.workingHoursSchedule
  ?? tenantStore.maybeTenant?.workingHoursSchedule
  ?? null,
)

const cycleIndices = computed(() => {
  const n = form.cycleLength ?? 0

  return Array.from({ length: Math.max(0, Math.min(30, n)) }, (_, i) => i)
})

// ─── helpers ─────────────────────────────────────────────

const FALLBACK_HOURS: DayHours = { isWorking: true, openTime: '09:00', closeTime: '18:00' }

// Конвертирует час закрытия из формата `working_hours_schedule` (где '24:00'
// означает «полночь следующих суток» для allDay) в формат UiTimepicker
// (валидный диапазон 00:00–23:59).
const branchCloseForTimepicker = (close: string): string => close === '24:00' ? '23:59' : close

const defaultHoursForDow = (dow: number): DayHours => {
  // Дефолт: часы филиала на этот день. Если филиал в этот день закрыт —
  // день шаблона тоже выходной. Если филиал не задан вообще — fallback 9-18.
  const hours = getBranchHoursForDow(referenceSchedule.value, dow)

  if (!hours) {
    // null означает «выходной» только если у филиала в принципе задан график;
    // если schedule вовсе нет — нужен fallback. Различаем через наличие schedule.
    if (referenceSchedule.value) {
      return { isWorking: false, openTime: '', closeTime: '' }
    }

    return { ...FALLBACK_HOURS }
  }

  return { isWorking: true, openTime: hours.open, closeTime: branchCloseForTimepicker(hours.close) }
}

// Часы «типичного рабочего дня филиала» — для shift-цикла, где dayIndex не
// привязан к дню недели. Берём первый рабочий день в порядке Пн..Вс.
const branchTypicalWorkingHours = (): DayHours => {
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    const h = getBranchHoursForDow(referenceSchedule.value, dow)

    if (h) {
      return { isWorking: true, openTime: h.open, closeTime: branchCloseForTimepicker(h.close) }
    }
  }

  return { ...FALLBACK_HOURS }
}

const isDayWorking = (dayIndex: number): boolean => form.dayHours[dayIndex]?.isWorking ?? false

const toggleDayOff = (dayIndex: number, off: boolean) => {
  if (off) {
    if (form.dayHours[dayIndex]) {
      form.dayHours[dayIndex] = { ...form.dayHours[dayIndex], isWorking: false }
    }
  } else {
    const existing = form.dayHours[dayIndex]

    // При возврате в рабочий — если есть сохранённые часы (просто isWorking=false),
    // включаем их обратно. Иначе берём часы филиала: для weekly на этот день
    // недели, для shift — типичный рабочий день филиала.
    if (existing && existing.openTime && existing.closeTime) {
      form.dayHours[dayIndex] = { ...existing, isWorking: true }
    } else if (form.type === 'weekly') {
      // Для weekly: если на этот dow филиал закрыт, всё равно включаем рабочий
      // день с фолбэком — раз пользователь явно снял «Выходной», ему нужны какие-то часы.
      const branch = getBranchHoursForDow(referenceSchedule.value, dayIndex)

      form.dayHours[dayIndex] = branch
        ? { isWorking: true, openTime: branch.open, closeTime: branchCloseForTimepicker(branch.close) }
        : branchTypicalWorkingHours()
    } else {
      form.dayHours[dayIndex] = branchTypicalWorkingHours()
    }
  }
}

// Первый рабочий день недели (Пн → Вс) для weekly.
const firstWorkingDow = computed<number | null>(() => {
  const order = [1, 2, 3, 4, 5, 6, 0]

  return order.find((d) => isDayWorking(d)) ?? null
})

// Первый рабочий день shift-цикла.
const firstWorkingShiftDay = computed<number | null>(() => {
  for (const i of cycleIndices.value) if (isDayWorking(i)) return i

  return null
})

const copyFirstWorkingDayToOthers = () => {
  const source = form.type === 'weekly' ? firstWorkingDow.value : firstWorkingShiftDay.value

  if (source === null) return
  const sourceHours = form.dayHours[source]

  if (!sourceHours) return

  const targets = form.type === 'weekly'
    ? [1, 2, 3, 4, 5, 6, 0].filter((d) => d !== source)
    : cycleIndices.value.filter((i) => i !== source)

  for (const t of targets) {
    if (isDayWorking(t)) {
      form.dayHours[t] = { ...sourceHours }
    }
  }
}

// ─── load / save ───────────────────────────────────────

const initWeeklyDefault = () => {
  // Дефолт = график филиала 1:1: рабочие дни филиала → рабочие в шаблоне с теми
  // же часами; выходные дни филиала → выходные в шаблоне.
  form.dayHours = {}
  for (let dow = 0; dow < 7; dow++) {
    form.dayHours[dow] = defaultHoursForDow(dow)
  }
}

const initShiftDefault = (length: number) => {
  // Для shift dayIndex не привязан к дню недели — берём типичные часы филиала.
  // Все дни цикла рабочие по умолчанию (юзер сам отметит выходные).
  const typical = branchTypicalWorkingHours()

  form.dayHours = {}
  for (let i = 0; i < length; i++) {
    form.dayHours[i] = { ...typical }
  }
}

watch(() => props.modelValue, async (open) => {
  if (!open) return

  formKey.value++

  const tid = tenantStore.currentTenantId

  if (!tid) return

  applyingTemplate.value = true

  try {
    if (props.template) {
      const full = await api.scheduleTemplates.getFull(props.template.id)

      if (full) {
        form.name = full.name
        form.type = full.type
        form.cycleLength = full.cycleLength ?? 4
        form.referenceBranchId = full.referenceBranchId

        const indices = full.type === 'weekly'
          ? [0, 1, 2, 3, 4, 5, 6]
          : Array.from({ length: full.cycleLength ?? 0 }, (_, i) => i)

        const hours: Record<number, DayHours> = {}

        for (const i of indices) {
          const day = full.days.find((d) => d.dayIndex === i)

          if (day && day.isWorking && day.openTime && day.closeTime) {
            hours[i] = { isWorking: true, openTime: day.openTime, closeTime: day.closeTime }
          } else {
            hours[i] = { isWorking: false, openTime: '', closeTime: '' }
          }
        }
        form.dayHours = hours
      }
    } else {
      Object.assign(form, {
        name: '',
        type: 'weekly',
        cycleLength: 4,
        referenceBranchId: null,
      })
      initWeeklyDefault()
    }

    await nextTick()
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить шаблон')
  } finally {
    applyingTemplate.value = false
  }
})

// При смене типа/длины цикла — переинициализируем часы дефолтами.
watch([() => form.type, () => form.cycleLength], ([newType, newLen], [oldType]) => {
  if (oldType === undefined) return
  if (applyingTemplate.value) return
  if (newType === 'shift') {
    initShiftDefault(newLen ?? 0)
  } else if (newType === 'weekly' && oldType === 'shift') {
    initWeeklyDefault()
  }
})

// ─── preview slot data для validateAgainstAttachedResources ─────

const buildPreviewSlotData = async (
  resource: Resource,
): Promise<{ slotData: ReturnType<typeof buildSlotDataFromWeeklyTemplate> } | null> => {
  const tid = tenantStore.currentTenantId

  if (!tid) return null

  const horizonStart = new Date().toISOString().slice(0, 10)
  const horizonEnd = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)

  const [overrides, dateDisabled, branchIds] = await Promise.all([
    api.resources.getDateOverridesRange(resource.id, horizonStart, horizonEnd),
    api.resources.getDateDisabledSlotsRange(resource.id, horizonStart, horizonEnd),
    api.resources.getBranchIds(resource.id),
  ])

  const branchId = branchIds[0]
  const branch = branchId ? branchStore.branches.find((b) => b.id === branchId) : null
  const branchSchedule = branch?.workingHoursSchedule
    ?? tenantStore.maybeTenant?.workingHoursSchedule
    ?? null

  const formDays = formToDays()

  if (form.type === 'shift') {
    if (!resource.cycleStartDate) return null

    return {
      slotData: buildSlotDataFromShiftTemplate(
        {
          id: props.template?.id ?? '',
          tenantId: tid,
          name: form.name,
          type: 'shift',
          cycleLength: form.cycleLength,
          referenceBranchId: form.referenceBranchId,
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
          days: formDays,
        },
        resource.cycleStartDate,
        branchSchedule,
        overrides,
        dateDisabled,
      ),
    }
  }

  return {
    slotData: buildSlotDataFromWeeklyTemplate(
      {
        id: props.template?.id ?? '',
        tenantId: tid,
        name: form.name,
        type: 'weekly',
        cycleLength: null,
        referenceBranchId: form.referenceBranchId,
        sortOrder: 0,
        createdAt: '',
        updatedAt: '',
        days: formDays,
      },
      branchSchedule,
      overrides,
      dateDisabled,
    ),
  }
}

const validateAgainstAttachedResources = async (): Promise<boolean> => {
  if (!props.template) return true
  const tid = tenantStore.currentTenantId

  if (!tid) return true

  const allResources = await api.resources.list(tid)
  const attached = allResources.filter((r) => r.appliedTemplateId === props.template!.id)

  if (attached.length === 0) return true

  const checks: { id: string; name: string; slotData: ReturnType<typeof buildSlotDataFromWeeklyTemplate> }[] = []

  for (const r of attached) {
    const built = await buildPreviewSlotData(r)

    if (!built) continue
    checks.push({ id: r.id, name: r.name, slotData: built.slotData })
  }

  const conflicts = await findConflicts(checks)

  if (conflicts.length === 0) return true

  const tz = tenantStore.tenant.timezone
  const fmt = new Intl.DateTimeFormat('ru', {
    timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const preview = conflicts.slice(0, 3).map((c) => {
    const date = fmt.format(new Date(c.appointment.startsAt))

    return `${c.resourceName}: ${date} — ${c.appointment.customerName}`
  }).join('; ')
  const more = conflicts.length > 3 ? ` и ещё ${conflicts.length - 3}` : ''

  await confirm({
    title: `${conflicts.length} ${pluralize(conflicts.length, 'запись', 'записи', 'записей')} попадёт вне расписания`,
    message: 'Сначала отмените или перенесите конфликтующие записи. Изменения шаблона затронут всех привязанных исполнителей.',
    alert: `${preview}${more}`,
    confirmText: false,
    cancelText: 'Понятно',
  })

  return false
}

const formToDays = (): ScheduleTemplateDay[] => {
  const indices = form.type === 'weekly'
    ? [0, 1, 2, 3, 4, 5, 6]
    : cycleIndices.value

  return indices.map((i) => {
    const h = form.dayHours[i]

    if (!h || !h.isWorking) {
      return { templateId: '', dayIndex: i, isWorking: false, openTime: null, closeTime: null }
    }

    return {
      templateId: '', dayIndex: i,
      isWorking: true,
      openTime: h.openTime || null,
      closeTime: h.closeTime || null,
    }
  })
}

const validateHours = (): string | null => {
  for (const i of (form.type === 'weekly' ? [0, 1, 2, 3, 4, 5, 6] : cycleIndices.value)) {
    const h = form.dayHours[i]

    if (!h?.isWorking) continue
    if (!h.openTime || !h.closeTime) {
      return `Укажите часы работы для дня ${form.type === 'weekly' ? DAYS.find((d) => d.value === i)?.label : i + 1}`
    }
    if (h.openTime === h.closeTime) {
      return 'Открытие и закрытие должны различаться'
    }
  }

  return null
}

const onSave = async () => {
  const valid = await formRef.value?.validate()

  if (!valid) return false

  const hoursError = validateHours()

  if (hoursError) {
    message.error(hoursError)

    return false
  }

  const tid = tenantStore.currentTenantId

  if (!tid) return false

  if (!await validateAgainstAttachedResources()) return false

  const payload = {
    name: form.name,
    type: form.type,
    cycleLength: form.type === 'shift' ? form.cycleLength : null,
    referenceBranchId: form.referenceBranchId,
    days: formToDays(),
  }

  try {
    if (props.template) {
      await api.scheduleTemplates.update(props.template.id, tid, payload)

      // Weekly: материализуется на ресурсе при apply. Чтобы edit реально
      // дотянулся до привязанных мастеров, переприменяем им шаблон.
      if (form.type === 'weekly') {
        const allResources = await api.resources.list(tid)
        const attached = allResources.filter((r) => r.appliedTemplateId === props.template!.id)

        await Promise.all(
          attached.map((r) => api.scheduleTemplates.applyWeeklyToResource(props.template!.id, r.id)),
        )
      }
    } else {
      await api.scheduleTemplates.create(tid, payload)
    }

    emit('saved')

    return true
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить шаблон')

    return false
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
  gap: var(--space-20);
}

.days {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.day-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
}

.day-head {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.hours-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.hint {
  color: var(--color-text-secondary);
}

.shift {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.shift-head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}
</style>
