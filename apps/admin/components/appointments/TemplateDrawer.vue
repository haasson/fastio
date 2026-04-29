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
          message="График филиала задаёт сетку слотов"
        />
      </UiForm>

      <!-- Weekly -->
      <div v-if="form.type === 'weekly'" class="days">
        <div v-for="day in DAYS" :key="day.value" class="day-block">
          <div class="day-head">
            <UiText weight="medium">{{ day.label }}</UiText>
            <UiCheckbox
              :model-value="dayOff.has(day.value)"
              @update:model-value="(v) => toggleDayOff(day.value, v)"
            >
              Выходной
            </UiCheckbox>
            <UiButton
              v-if="day.value === firstWorkingDow && hasFirstWorkingDaySlots"
              size="tiny"
              type="text"
              icon="copy"
              @click="copyFirstWorkingDayToOthers"
            >
              Скопировать в остальные
            </UiButton>
          </div>
          <template v-if="!dayOff.has(day.value)">
            <div v-if="branchSlotsForDow(day.value).length" class="slot-grid">
              <UiTag
                v-for="slot in branchSlotsForDow(day.value)"
                :key="slot"
                :type="isSlotActive(day.value, slot) ? 'success' : 'default'"
                :empty="!isSlotActive(day.value, slot)"
                hoverable
                size="medium"
                class="slot-tag"
                :class="{ 'slot-tag--off': !isSlotActive(day.value, slot) }"
                @click="toggleSlot(day.value, slot)"
              >
                {{ slot }}
              </UiTag>
            </div>
            <UiText v-else size="tiny" class="hint">Филиал закрыт</UiText>
          </template>
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
          {{ shiftWindowLabel }} · Дату старта цикла задаёте на сотруднике при применении шаблона.
        </UiText>
        <div class="days">
          <div v-for="i in cycleIndices" :key="i" class="day-block">
            <div class="day-head">
              <UiText weight="medium">День {{ i + 1 }}</UiText>
              <UiCheckbox
                :model-value="dayOff.has(i)"
                @update:model-value="(v) => toggleDayOff(i, v)"
              >
                Выходной
              </UiCheckbox>
            </div>
            <template v-if="!dayOff.has(i)">
              <div v-if="shiftBranchSlots.length" class="slot-grid">
                <UiTag
                  v-for="slot in shiftBranchSlots"
                  :key="slot"
                  :type="isSlotActive(i, slot) ? 'success' : 'default'"
                  :empty="!isSlotActive(i, slot)"
                  hoverable
                  size="medium"
                  class="slot-tag"
                  :class="{ 'slot-tag--off': !isSlotActive(i, slot) }"
                  @click="toggleSlot(i, slot)"
                >
                  {{ slot }}
                </UiTag>
              </div>
              <UiText v-else size="tiny" class="hint">Филиал закрыт во все дни</UiText>
            </template>
          </div>
        </div>
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import {
  UiDrawer, UiForm, UiInput, UiSelect, UiInputNumber, UiButton, UiTag, UiText, UiCheckbox,
  useConfirm, useMessage,
} from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type {
  ScheduleTemplate, ScheduleTemplateSlot, ScheduleTemplateType,
  Branch, WorkingHoursSchedule, Resource,
} from '@fastio/shared'
import {
  getAllSlotsInWindow, getBranchHoursForDow, getBranchWidestWindow, pluralize,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useScheduleConflictCheck } from '~/composables/data/useScheduleConflictCheck'
import {
  buildSlotDataFromWeeklyTemplate, buildSlotDataFromShiftTemplate,
} from '~/utils/scheduleConflictCheck'
import { reportError } from '~/utils/reportError'

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

type Form = {
  name: string
  type: ScheduleTemplateType
  cycleLength: number | null
  referenceBranchId: string | null
  slots: ScheduleTemplateSlot[]
}

const form = reactive<Form>({
  name: '',
  type: 'weekly',
  cycleLength: 4,
  referenceBranchId: null,
  slots: [],
})

const slotStep = ref(30)
const branches = ref<Branch[]>([])

// Флаг блокирует watch на смене type/cycleLength во время загрузки сохранённого
// шаблона: иначе watch сбросит form.slots на дефолт, и при сохранении в БД
// уйдут пустые/дефолтные слоты вместо отредактированных пользователем.
const applyingTemplate = ref(false)

const branchSelectorOptions = computed(() => {
  // Если все филиалы имеют одинаковый рабочий график — селектор не нужен.
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

// Если у филиала график не задан — наследует график тенанта (общие настройки).
const referenceSchedule = computed<WorkingHoursSchedule | null>(() => referenceBranch.value?.workingHoursSchedule
  ?? tenantStore.maybeTenant?.workingHoursSchedule
  ?? null,
)

const branchSlotsForDow = (dow: number): string[] => {
  const hours = getBranchHoursForDow(referenceSchedule.value, dow)

  if (!hours) return []

  return getAllSlotsInWindow(hours.open, hours.close, slotStep.value)
}

const shiftBranchSlots = computed<string[]>(() => {
  const win = getBranchWidestWindow(referenceSchedule.value)

  if (!win) return []

  return getAllSlotsInWindow(win.open, win.close, slotStep.value)
})

const shiftWindowLabel = computed(() => {
  const win = getBranchWidestWindow(referenceSchedule.value)

  if (!win) return 'У филиала не задан график работы'

  return `Доступные слоты: ${win.open}—${win.close}`
})

const cycleIndices = computed(() => {
  const n = form.cycleLength ?? 0

  return Array.from({ length: Math.max(0, Math.min(30, n)) }, (_, i) => i)
})

// ─── slots ─────────────────────────────────────────────

// Выходные дни: dayIndex (0-6 для weekly, 0..cycleLength-1 для shift).
// День без слотов в существующем шаблоне = выходной (на загрузке вычисляется).
const dayOff = ref<Set<number>>(new Set())

const isSlotActive = (dayIndex: number, slot: string): boolean => form.slots.some((s) => s.dayIndex === dayIndex && s.slotTime === slot)

const slotsForDayIndex = (dayIndex: number): string[] => form.type === 'weekly'
  ? branchSlotsForDow(dayIndex)
  : shiftBranchSlots.value

const toggleSlot = (dayIndex: number, slot: string) => {
  if (isSlotActive(dayIndex, slot)) {
    form.slots = form.slots.filter((s) => !(s.dayIndex === dayIndex && s.slotTime === slot))
  } else {
    form.slots.push({ templateId: '', dayIndex, slotTime: slot })
  }
}

const toggleDayOff = (dayIndex: number, off: boolean) => {
  if (off) {
    dayOff.value.add(dayIndex)
    form.slots = form.slots.filter((s) => s.dayIndex !== dayIndex)
  } else {
    dayOff.value.delete(dayIndex)
    // По умолчанию все слоты дня — активны.
    const all = slotsForDayIndex(dayIndex)

    form.slots = form.slots.filter((s) => s.dayIndex !== dayIndex)
    for (const slot of all) {
      form.slots.push({ templateId: '', dayIndex, slotTime: slot })
    }
  }
  // Триггерим реактивность Set.
  dayOff.value = new Set(dayOff.value)
}

// Первый рабочий день недели (в порядке Пн → Вс) — на нём показываем
// кнопку «Скопировать в остальные».
const firstWorkingDow = computed<number | null>(() => {
  const order = [1, 2, 3, 4, 5, 6, 0]

  return order.find((d) => !dayOff.value.has(d)) ?? null
})

const hasFirstWorkingDaySlots = computed(() => firstWorkingDow.value !== null
  && form.slots.some((s) => s.dayIndex === firstWorkingDow.value),
)

const copyFirstWorkingDayToOthers = () => {
  const source = firstWorkingDow.value

  if (source === null) return

  const sourceSlots = form.slots.filter((s) => s.dayIndex === source).map((s) => s.slotTime)
  // Применяем только в рабочие (не-выходные) дни, где филиал открыт.
  const targets = [1, 2, 3, 4, 5, 6, 0].filter((d) => d !== source && !dayOff.value.has(d))

  form.slots = form.slots.filter((s) => !targets.includes(s.dayIndex))
  for (const dow of targets) {
    const allowed = new Set(branchSlotsForDow(dow))

    if (allowed.size === 0) continue
    for (const slot of sourceSlots) {
      if (allowed.has(slot)) {
        form.slots.push({ templateId: '', dayIndex: dow, slotTime: slot })
      }
    }
  }
}

// ─── load / save ───────────────────────────────────────

watch(() => props.modelValue, async (open) => {
  if (!open) return

  formKey.value++

  const tid = tenantStore.currentTenantId

  if (!tid) return

  applyingTemplate.value = true

  try {
    const [settings, branchList] = await Promise.all([
      api.appointmentSettings.get(tid),
      api.branches.list(tid),
    ])

    slotStep.value = settings?.slotStepMinutes ?? 30
    branches.value = branchList

    if (props.template) {
      const full = await api.scheduleTemplates.getFull(props.template.id)

      if (full) {
        form.name = full.name
        form.type = full.type
        form.cycleLength = full.cycleLength ?? 4
        form.referenceBranchId = full.referenceBranchId
        form.slots = full.slots
        // День без слотов в сохранённом шаблоне трактуем как выходной.
        const off = new Set<number>()
        const indices = full.type === 'weekly' ? [0, 1, 2, 3, 4, 5, 6] : Array.from({ length: full.cycleLength ?? 0 }, (_, i) => i)

        for (const i of indices) {
          if (!full.slots.some((s) => s.dayIndex === i)) off.add(i)
        }
        dayOff.value = off
      }
    } else {
      Object.assign(form, {
        name: '',
        type: 'weekly',
        cycleLength: 4,
        referenceBranchId: null,
        slots: [],
      })
      // Новый шаблон: Пн-Пт рабочие со всеми слотами, Сб/Вс выходные.
      dayOff.value = new Set([0, 6])
      const fresh: ScheduleTemplateSlot[] = []

      for (const dow of [1, 2, 3, 4, 5]) {
        for (const slot of branchSlotsForDow(dow)) {
          fresh.push({ templateId: '', dayIndex: dow, slotTime: slot })
        }
      }
      form.slots = fresh
    }

    await nextTick()
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить шаблон')
  } finally {
    applyingTemplate.value = false
  }
})

// При смене типа (weekly/shift) или длины цикла — переинициализируем слоты
// и выходные дефолтами (все дни рабочие, все слоты выбраны).
watch([() => form.type, () => form.cycleLength], ([newType, newLen], [oldType]) => {
  if (oldType === undefined) return // первая установка обрабатывается в watch(modelValue)
  if (applyingTemplate.value) return // не сбрасываем слоты при загрузке существующего шаблона
  if (newType === 'shift') {
    const len = newLen ?? 0

    dayOff.value = new Set()
    const fresh: ScheduleTemplateSlot[] = []

    for (let i = 0; i < len; i++) {
      for (const slot of shiftBranchSlots.value) {
        fresh.push({ templateId: '', dayIndex: i, slotTime: slot })
      }
    }
    form.slots = fresh
  } else if (newType === 'weekly' && oldType === 'shift') {
    dayOff.value = new Set([0, 6])
    const fresh: ScheduleTemplateSlot[] = []

    for (const dow of [1, 2, 3, 4, 5]) {
      for (const slot of branchSlotsForDow(dow)) {
        fresh.push({ templateId: '', dayIndex: dow, slotTime: slot })
      }
    }
    form.slots = fresh
  }
})

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

  // Для shift: cycleStartDate уже на ресурсе. Если шаблон сменился с weekly
  // на shift — у ресурса нет cycleStartDate, в этом случае пропускаем
  // (применение шаблона к ресурсу разово выставит дату).
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
          slots: form.slots,
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
        slots: form.slots,
      },
      branchSchedule,
      slotStep.value,
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

const onSave = async () => {
  const valid = await formRef.value?.validate()

  if (!valid) return false

  const tid = tenantStore.currentTenantId

  if (!tid) return false

  if (!await validateAgainstAttachedResources()) return false

  const payload = {
    name: form.name,
    type: form.type,
    cycleLength: form.type === 'shift' ? form.cycleLength : null,
    referenceBranchId: form.referenceBranchId,
    slots: form.slots,
  }

  try {
    if (props.template) {
      await api.scheduleTemplates.update(props.template.id, tid, payload)

      // Weekly-шаблон материализуется на ресурсе при apply. Чтобы edit реально
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

.day-head > .hint {
  flex: 1;
}

.hint {
  color: var(--color-text-secondary);
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: var(--space-8);
}

.slot-tag {
  justify-content: center;
  width: 100%;
  user-select: none;
}

.slot-tag--off :deep(.n-tag__content) {
  text-decoration: line-through;
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
