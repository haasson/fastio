<template>
  <div class="resources-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="openCreate">Добавить</UiButton>
    </div>

    <UiSkeleton v-if="loading" :repeat="3" />

    <UiEmpty
      v-else-if="!resources.length"
      icon="package"
      text="Нет объектов"
      description="Создайте первый объект — например, бильярдный стол или комнату для сауны"
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
        <UiText size="small" class="hint">Количество: {{ resource.capacity }}</UiText>
        <template #append>
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
      type="object"
      @saved="fetch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiText, UiTag, UiSkeleton, UiEmpty, useConfirm, useMessage } from '@fastio/ui'
import type { Resource } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import ResourceDrawer from '~/features/appointments/components/ResourceDrawer.vue'
import AppDraggableList from '~/shared/ui/components/AppDraggableList.vue'
import AppListRow from '~/shared/ui/components/AppListRow.vue'
import AppActionsBlock from '~/shared/ui/components/AppActionsBlock.vue'
import { useResourcePresence, type PresenceStatus } from '~/features/appointments'
import { reportError } from '~/shared/utils/reportError'

const formatDateRu = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)

  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })
    .format(new Date(y, m - 1, d))
}

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
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

    resources.value = all.filter((r) => r.type === 'object')
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить список объектов')
  } finally {
    loading.value = false
  }
}

fetch()

const drawerOpen = ref(false)
const selected = ref<Resource | null>(null)

const openCreate = () => {
  selected.value = null
  drawerOpen.value = true
}

const openEdit = (resource: Resource) => {
  selected.value = resource
  drawerOpen.value = true
}

const onReorder = async () => {
  await api.resources.setOrder(resources.value.map((r) => r.id))
}

const confirmDelete = async (resource: Resource) => {
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
      title: `На объекте ${conflicts.total} ${pluralize(conflicts.total, 'запись', 'записи', 'записей')}`,
      message: 'Удалить нельзя. Сначала перенесите или отмените активные записи.',
      alert: `${preview}${more}`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  const ok = await confirm({
    title: 'Удалить объект?',
    message: `«${resource.name}» больше нельзя будет забронировать.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

  try {
    await api.resources.remove(resource.id)
    await fetch()
    message.success('Объект удалён')
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

.hint {
  color: var(--color-text-secondary);
}
</style>
