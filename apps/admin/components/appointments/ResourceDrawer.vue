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

        <UiTree
          v-model="checkedKeys"
          :data="treeData"
          :default-expanded-keys="defaultExpandedKeys"
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

      <OffPeriodsSection v-if="resource" :resource="resource" ref="offPeriodsRef" />
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiDrawer, UiForm, UiInput, UiSelect, UiTitle, UiButton, UiAlert, UiDatepicker, UiInputNumber, UiSkeleton, UiTree, useConfirm, useMessage } from '@fastio/ui'
import type { UiTreeNode } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Resource, Service, Category, ScheduleTemplate, ResourceType } from '@fastio/shared'
import { pluralize, utcIsoToLocalDateTime, addDaysToDateStr, todayInTz } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTeam } from '~/composables/data/useTeam'
import { useScheduleConflictCheck } from '~/composables/data/useScheduleConflictCheck'
import {
  buildSlotDataFromWeeklyTemplate, buildSlotDataFromShiftTemplate,
} from '~/utils/scheduleConflictCheck'
import { reportError } from '~/utils/reportError'
import OffPeriodsSection from '~/components/appointments/OffPeriodsSection.vue'

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
const offPeriodsRef = ref<InstanceType<typeof OffPeriodsSection> | null>(null)
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

const treeData = computed<UiTreeNode[]>(() => categories.value.map((c) => ({
  key: `cat:${c.id}`,
  label: c.name,
  hint: 'все услуги, включая новые',
  children: services.value
    .filter((s) => s.categoryId === c.id && s.isBookable)
    .map((s) => ({ key: `svc:${s.id}`, label: s.name })),
})),
)

const checkedKeys = computed<string[]>({
  get: () => [
    ...form.categoryIds.map((id) => `cat:${id}`),
    ...form.serviceIds.map((id) => `svc:${id}`),
  ],
  set: (keys) => {
    const catIds = keys.filter((k) => k.startsWith('cat:')).map((k) => k.slice(4))

    form.categoryIds = catIds
    // NaiveUI cascade эмитит ключи детей даже когда выбран родитель целиком.
    // Убираем такие svc-ключи: если категория уже в catIds, её услуги покрыты через
    // resource_categories и не нужны в service_resources отдельно.
    form.serviceIds = keys
      .filter((k) => k.startsWith('svc:'))
      .map((k) => k.slice(4))
      .filter((svcId) => {
        const svc = services.value.find((s) => s.id === svcId)

        return svc ? !catIds.includes(svc.categoryId ?? '') : true
      })
  },
})

const defaultExpandedKeys = ref<string[]>([])

const templateOptions = computed(() => allTemplates.value.map((t) => ({
  label: t.type === 'shift' ? `${t.name} (цикл ${t.cycleLength} дн.)` : t.name,
  value: t.id,
})),
)

const selectedTemplate = computed<ScheduleTemplate | null>(() => allTemplates.value.find((t) => t.id === form.templateId) ?? null,
)

// Дата timestamp'а В ТАЙМЗОНЕ ТЕНАНТА. `.toISOString().slice(0,10)` сдвигает
// на сутки около полуночи для тенантов с большим offset (Asia/Tokyo,
// Pacific/Auckland) — поэтому идём через утилиту, опирающуюся на Intl.DateTimeFormat.
const tsToDateStr = (ts: number | null): string | null => {
  if (!ts) return null

  return utcIsoToLocalDateTime(new Date(ts).toISOString(), tenantStore.tenant.timezone).dateStr
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

  const [branchIds, serviceIds, categoryIds] = await Promise.all([
    api.resources.getBranchIds(resource.id),
    api.resources.getServiceIds(resource.id),
    api.resources.getCategoryIds(resource.id),
  ])

  form.branchId = branchIds[0] ?? null
  form.serviceIds = serviceIds
  form.categoryIds = categoryIds
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
  }

  // Раскрываем категории где есть штучно выбранные услуги
  defaultExpandedKeys.value = categories.value
    .filter((c) => services.value.some((s) => s.categoryId === c.id && form.serviceIds.includes(s.id)))
    .map((c) => `cat:${c.id}`)
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

  if (!form.categoryIds.length && !form.serviceIds.length) {
    message.error('Выберите хотя бы одну услугу или категорию')

    return false
  }

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
      if (!isCreate) await offPeriodsRef.value?.reload()
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
</style>
