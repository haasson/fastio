<template>
  <div class="list-root">
    <UiTag v-if="ctx.totalReadyCount > 0" type="success" round>
      {{ ctx.totalReadyCount }} {{ readyLabel }} к подаче
    </UiTag>

    <UiSkeleton v-if="ctx.loading" :repeat="6" />

    <template v-else>
      <div class="list-header">
        <UiButton
          v-if="canManageTables"
          size="small"
          type="primary"
          icon="plus"
          @click="createTable"
        >Новый стол</UiButton>
      </div>

      <template v-if="ctx.openTables.length || ctx.closedTables.length">
        <template v-if="ctx.openTables.length">
          <UiSectionHeader title="Открытые" />
          <div class="table-grid">
            <TableCard
              v-for="table in ctx.openTables"
              :key="table.id"
              :table="table"
              :session="ctx.tableSums[table.id]"
              :calls="ctx.callsByTable[table.id] ?? []"
              :kitchen-dishes="ctx.kitchenDishes[table.id] ?? []"
              :ready-dishes="ctx.readyDishes[table.id] ?? []"
              @edit="openEdit(table)"
              @show-qr="openQr(table)"
              @add-dish="openPicker(table)"
              @checkout="ctx.checkout(table)"
              @resolve-call="ctx.onCallResolved"
              @mark-served="ctx.onMarkServed"
              @remove-dish="(item) => ctx.onRemoveDish(table, item)"
              @confirm-item="(itemId) => ctx.onConfirmItem(itemId, table.id)"
              @reject-item="(itemId) => ctx.onRejectItem(itemId, table.id)"
              @confirm-all="ctx.onConfirmAllItems(table.id)"
            />
          </div>
        </template>

        <template v-if="ctx.closedTables.length">
          <UiSectionHeader title="Закрытые" />
          <div class="table-grid">
            <TableCard
              v-for="table in ctx.closedTables"
              :key="table.id"
              :table="table"
              :calls="[]"
              @edit="openEdit(table)"
              @show-qr="openQr(table)"
              @toggle-open="ctx.toggleOpen(table)"
            />
          </div>
        </template>
      </template>

      <UiEmpty v-if="!ctx.openTables.length && !ctx.closedTables.length" icon="tableIcon" text="Столов пока нет" />
    </template>

    <DishPickerModal
      v-if="ctx.tenantId"
      :model-value="dishPickerOpen"
      :tenant-id="ctx.tenantId"
      show-combos
      :show-ingredients="gate.ingredients.value.enabled"
      @select="onDishPicked"
      @update:model-value="dishPickerOpen = $event"
    />

    <TableEditModal
      v-model="editModalOpen"
      :table="editModalTable"
      :is-new="editModalIsNew"
      :default-name="editDefaultName"
      :saving="modalSaving"
      @submit="onModalSubmit"
      @delete="onModalDelete"
    />

    <TableQrModal
      v-model="qrModalOpen"
      :table="qrModalTable"
      :all-tables="allTables"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiEmpty, UiSkeleton, UiSectionHeader, UiTag, useMessage } from '@fastio/ui'
import type { Table } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTablesContext, useAddDishToTable } from '~/features/tables'
import { useGate } from '~/shared/plan/useGate'
import { useBranchStore } from '~/shared/stores/branch'
import { useAuditLog } from '~/features/audit-log'
import DishPickerModal from '~/features/menu/components/DishPickerModal.vue'
import TableCard from '~/features/tables/components/TableCard.vue'
import TableEditModal, { type TableFormPayload } from '~/features/tables/components/TableEditModal.vue'
import TableQrModal from '~/features/tables/components/TableQrModal.vue'

const ctx = useTablesContext()

const api = useDatabase()
const gate = useGate()
const branchStore = useBranchStore()
const { success, warning } = useMessage()
const { log } = useAuditLog()
const canManageTables = computed(() => gate.manageTables.value.enabled)

const { dishPickerOpen, openPicker, onDishPicked } = useAddDishToTable(() => ctx.tenantId)

const editModalOpen = ref(false)
const editModalTable = ref<Table | null>(null)
const editModalIsNew = ref(false)
const editModalBranchId = ref<string | null>(null)
const modalSaving = ref(false)

const qrModalOpen = ref(false)
const qrModalTable = ref<Table | null>(null)
const allTables = computed(() => [...ctx.openTables, ...ctx.closedTables])

const readyLabel = computed(() => {
  const n = ctx.totalReadyCount

  return `${pluralize(n, 'блюдо', 'блюда', 'блюд')} ${pluralize(n, 'готово', 'готовы', 'готово')}`
})

const editDefaultName = computed(() => `Стол ${allTables.value.length + 1}`)

// Открываем модалку в режиме создания БЕЗ записи в БД. Реальный insert — только
// по «Создать» (onModalSubmit). «Отмена» ничего не персистит.
const createTable = () => {
  const tenantId = ctx.tenantId

  if (!tenantId) return

  // D-04: один филиал → берём его id; мультибранч → берём текущий (при саммари кнопка скрыта)
  const branchId = ctx.branches.length === 1
    ? ctx.branches[0].id
    : branchStore.currentBranchId

  // Инвариант: стол всегда принадлежит филиалу. Без выбранного филиала
  // (тенант без филиалов) — не создаём, чтобы не упереться в NOT NULL.
  if (!branchId) {
    warning('Сначала создайте филиал — стол не может существовать без него')

    return
  }

  editModalTable.value = null
  editModalIsNew.value = true
  editModalBranchId.value = branchId
  editModalOpen.value = true
}

const onModalSubmit = async (payload: TableFormPayload) => {
  const tenantId = ctx.tenantId

  if (!tenantId) return

  modalSaving.value = true
  try {
    if (editModalIsNew.value) {
      const branchId = editModalBranchId.value

      if (!branchId) {
        warning('Сначала создайте филиал — стол не может существовать без него')

        return
      }

      const created = await api.tables.add(tenantId, {
        name: payload.name,
        branchId,
        capacity: payload.capacity,
        notes: payload.notes,
        shape: payload.shape,
      })

      if (created) {
        ctx.onTableAdded(created)
        success('Стол создан')
        editModalOpen.value = false
      }
    } else {
      const table = editModalTable.value

      if (!table) return

      const [updated] = await Promise.all([
        api.tables.updateMeta(table.id, {
          name: payload.name,
          capacity: payload.capacity,
          notes: payload.notes,
          shape: payload.shape,
        }),
        payload.isActive !== table.isActive
          ? api.tables.setActive(table.id, payload.isActive)
          : null,
      ])

      if (updated) {
        ctx.onTableUpdated({ ...updated, isActive: payload.isActive })
        success('Стол обновлён')
        editModalOpen.value = false
      }
    }
  } catch (error) {
    reportError(error, { context: 'tables.list.onModalSubmit', tenantId })
    warning('Не удалось сохранить стол')
  } finally {
    modalSaving.value = false
  }
}

const onModalDelete = async (id: string) => {
  const table = editModalTable.value

  modalSaving.value = true
  try {
    await api.tables.archive(id)
    log({
      action: 'table.delete',
      entityType: 'table',
      entityId: id,
      entityName: table?.name ?? '',
      payload: { capacity: table?.capacity, shape: table?.shape },
    })
    ctx.onTableDeleted(id)
    success('Стол удалён')
    editModalOpen.value = false
  } catch (error) {
    reportError(error, { context: 'tables.list.onModalDelete' })
    warning('Не удалось удалить стол')
  } finally {
    modalSaving.value = false
  }
}

const openEdit = (table: Table) => {
  editModalTable.value = table
  editModalIsNew.value = false
  editModalOpen.value = true
}

const openQr = (table: Table) => {
  qrModalTable.value = table
  qrModalOpen.value = true
}

</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.list-root {
  @include flex-col(var(--space-20));
}

.list-header {
  display: flex;
  justify-content: flex-end;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 340px));
  gap: var(--space-12);
}
</style>
