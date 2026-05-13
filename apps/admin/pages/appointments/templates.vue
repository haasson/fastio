<template>
  <div class="templates-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="openCreate">Добавить</UiButton>
    </div>

    <UiSkeleton v-if="loading" :repeat="3" />

    <UiEmpty
      v-else-if="!templates.length"
      icon="calendar"
      text="Шаблонов пока нет"
      description="Создайте шаблон один раз и применяйте его к сотрудникам и объектам — недельные графики либо сменные циклы"
    />

    <UiDraggableList
      v-else
      v-model="templates"
      @reorder="onReorder"
    >
      <UiListRow
        v-for="tpl in templates"
        :key="tpl.id"
        :name="tpl.name"
      >
        <template #name>
          <div class="name-row">
            <UiText size="small" weight="medium">{{ tpl.name }}</UiText>
            <UiBadge :type="tpl.type === 'shift' ? 'info' : 'default'">
              {{ tpl.type === 'shift' ? `Цикл ${tpl.cycleLength} дн.` : 'По дням недели' }}
            </UiBadge>
          </div>
        </template>
        <UiText size="small" class="hint">{{ describe(tpl) }}</UiText>
        <template #append>
          <UiRowActions
            size="small"
            @edit="openEdit(tpl)"
            @delete="confirmDelete(tpl)"
          />
        </template>
      </UiListRow>
    </UiDraggableList>

    <TemplateDrawer
      v-model="drawerOpen"
      :template="selected"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { UiButton, UiText, UiBadge, UiSkeleton, UiEmpty, useConfirm, useMessage, UiListRow, UiDraggableList, UiRowActions } from '@fastio/ui'
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { ScheduleTemplate } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import TemplateDrawer from '~/features/appointments/components/TemplateDrawer.vue'
import { reportError } from '~/shared/utils/reportError'

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()

const templates = ref<ScheduleTemplate[]>([])
const loading = ref(false)

const fetch = async () => {
  if (!currentTenantId.value) return
  loading.value = true
  try {
    templates.value = await api.scheduleTemplates.list(currentTenantId.value)
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить шаблоны')
  } finally {
    loading.value = false
  }
}

fetch()

const drawerOpen = ref(false)
const selected = ref<ScheduleTemplate | null>(null)

const openCreate = () => {
  selected.value = null
  drawerOpen.value = true
}

const openEdit = (tpl: ScheduleTemplate) => {
  selected.value = tpl
  drawerOpen.value = true
}

const onSaved = () => {
  drawerOpen.value = false
  fetch()
}

const onReorder = async () => {
  await api.scheduleTemplates.setOrder(templates.value.map((t) => t.id))
}

const confirmDelete = async (tpl: ScheduleTemplate) => {
  const linked = await api.scheduleTemplates.resourcesUsingTemplate(tpl.id)

  if (linked.length > 0) {
    const names = linked.map((r) => r.name).join(', ')

    message.error(`Шаблон применён к: ${names}. Сначала смените график у этих исполнителей.`)

    return
  }

  const ok = await confirm({
    title: 'Удалить шаблон?',
    message: `«${tpl.name}» больше нельзя будет применить. Уже применённые расписания не пострадают.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

  try {
    await api.scheduleTemplates.remove(tpl.id)
    await fetch()
    message.success('Шаблон удалён')
  } catch (e) {
    reportError(e)
    message.error((e as Error).message)
  }
}

const describe = (tpl: ScheduleTemplate): string => {
  if (tpl.type === 'weekly') return 'Расписание по дням недели'

  return `Сменный цикл (${tpl.cycleLength} дн.)`
}
</script>

<style scoped lang="scss">
.templates-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-16);
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
