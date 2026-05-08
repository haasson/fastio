<template>
  <div class="resources-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="openCreate">Добавить</UiButton>
    </div>

    <UiSkeleton v-if="loading" :repeat="3" />

    <UiEmpty
      v-else-if="!resources.length"
      icon="users"
      text="Нет сотрудников"
      description="Добавьте первого сотрудника из команды"
    />

    <AppDraggableList
      v-else
      v-model="resources"
      @reorder="onReorder"
    >
      <AppListRow
        v-for="resource in resources"
        :key="resource.id"
        :name="resource.name"
        :disabled="!resource.isActive"
      >
        <template #name>
          <div class="name-row">
            <UiText size="small" weight="medium">{{ resource.name }}</UiText>
            <UiTag v-if="presenceLabel(resource.id)" size="small" :type="presenceType(resource.id)">
              {{ presenceLabel(resource.id) }}
            </UiTag>
          </div>
        </template>
        <template #append>
          <UiButton
            type="text"
            size="small"
            icon="calendar"
            @click="openSchedule(resource)"
          />
          <AppActionsBlock
            size="small"
            @edit="openEdit(resource)"
            @delete="confirmDelete(resource)"
          />
        </template>
      </AppListRow>
    </AppDraggableList>

    <ResourceDrawer
      v-model="drawerOpen"
      :resource="selected"
      type="person"
      @saved="fetch"
    />

    <StaffScheduleModal
      v-model="scheduleOpen"
      :resource="scheduleResource"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiText, UiTag, UiSkeleton, UiEmpty, useConfirm, useMessage } from '@fastio/ui'
import type { Resource } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import ResourceDrawer from '~/components/appointments/ResourceDrawer.vue'
import StaffScheduleModal from '~/components/appointments/StaffScheduleModal.vue'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import { useResourcePresence, type PresenceStatus } from '~/composables/services/useResourcePresence'
import { reportError } from '~/utils/reportError'

const formatDateRu = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)

  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })
    .format(new Date(y, m - 1, d))
}

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const branchStore = useBranchStore()
const { currentBranchId } = storeToRefs(branchStore)
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()

const resources = ref<Resource[]>([])
const loading = ref(false)

const { statusByResource, absentUntilByResource } = useResourcePresence(resources)

const presenceLabel = (id: string): string => {
  const s = statusByResource.value.get(id)

  if (s === 'hidden') return 'Скрыт'
  if (s === 'absent') {
    const until = absentUntilByResource.value.get(id)

    return until ? `Отсутствует до ${formatDateRu(until)}` : 'Отсутствует'
  }
  if (s === 'off-hours') return 'Не работает сейчас'

  return ''
}

const presenceType = (id: string): 'default' | 'warning' => {
  const s = statusByResource.value.get(id) as PresenceStatus | undefined

  if (s === 'absent') return 'warning'

  return 'default'
}

const fetch = async () => {
  if (!currentTenantId.value) return
  loading.value = true
  try {
    const all = await api.resources.list(currentTenantId.value)
    const persons = all.filter((r) => r.type === 'person')

    if (currentBranchId.value) {
      const branchIds = await api.resources.listBranchIds(persons.map((r) => r.id))

      resources.value = persons.filter((r) => {
        const ids = branchIds.get(r.id) ?? []

        return ids.length === 0 || ids.includes(currentBranchId.value!)
      })
    } else {
      resources.value = persons
    }
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить список сотрудников')
  } finally {
    loading.value = false
  }
}

fetch()
watch(currentBranchId, fetch)

const drawerOpen = ref(false)
const selected = ref<Resource | null>(null)

const scheduleOpen = ref(false)
const scheduleResource = ref<Resource | null>(null)

const openCreate = () => {
  selected.value = null
  drawerOpen.value = true
}

const openEdit = (resource: Resource) => {
  selected.value = resource
  drawerOpen.value = true
}

const openSchedule = (resource: Resource) => {
  scheduleResource.value = resource
  scheduleOpen.value = true
}

watch(scheduleOpen, (v) => {
  if (!v) scheduleResource.value = null
})

const onReorder = async () => {
  await api.resources.setOrder(resources.value.map((r) => r.id))
}

const confirmDelete = async (resource: Resource) => {
  // Сначала смотрим — есть ли активные записи. Если да — удалять нельзя,
  // показываем список и просим разобраться вручную.
  if (!currentTenantId.value) return
  const conflicts = await api.appointments.listPaginated(currentTenantId.value, {
    resourceId: resource.id,
    statuses: ['new', 'confirmed'],
    page: 1,
    pageSize: 50,
    sortDir: 'asc',
  })

  if (conflicts.total > 0) {
    const tz = tenantStore.tenant.timezone
    const fmt = new Intl.DateTimeFormat('ru', {
      timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    const preview = conflicts.data.slice(0, 3).map((a) => `${fmt.format(new Date(a.startsAt))} — ${a.customerName}`).join('; ')
    const more = conflicts.total > 3 ? ` и ещё ${conflicts.total - 3}` : ''

    await confirm({
      title: `У сотрудника ${conflicts.total} ${pluralize(conflicts.total, 'запись', 'записи', 'записей')}`,
      message: 'Удалить нельзя. Сначала перенесите или отмените активные записи.',
      alert: `${preview}${more}`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  const ok = await confirm({
    title: 'Удалить сотрудника?',
    message: `«${resource.name}» больше нельзя будет назначить в записи.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

  try {
    await api.resources.remove(resource.id)
    await fetch()
    message.success('Сотрудник удалён')
  } catch (e) {
    reportError(e)
    message.error((e as Error).message)
  }
}

</script>

<style scoped lang="scss">
.resources-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.header {
  display: flex;
  justify-content: flex-end;
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}
</style>
