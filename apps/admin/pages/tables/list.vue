<template>
  <div class="list-root">
    <UiTag v-if="ctx.totalReadyCount > 0" type="success" round>
      {{ ctx.totalReadyCount }} {{ ctx.totalReadyCount === 1 ? 'блюдо готово' : 'блюд готово' }} к подаче
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
      show-ingredients
      @select="onDishPicked"
      @update:model-value="dishPickerOpen = $event"
    />

    <TableEditModal
      v-model="editModalOpen"
      :table="editModalTable"
      :is-new="editModalIsNew"
      @updated="ctx.onTableUpdated"
      @deleted="ctx.onTableDeleted"
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
import { UiButton, UiEmpty, UiSkeleton, UiSectionHeader, UiTag } from '@fastio/ui'
import type { Table } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTablesContext } from '~/composables/ui/useTablesContext'
import useAddDishToTable from '~/composables/ui/useAddDishToTable'
import { usePermissions } from '~/composables/auth/usePermissions'
import DishPickerModal from '~/components/menu/DishPickerModal.vue'
import TableCard from '~/components/tables/TableCard.vue'
import TableEditModal from '~/components/tables/TableEditModal.vue'
import TableQrModal from '~/components/tables/TableQrModal.vue'

const ctx = useTablesContext()

const api = useDatabase()
const { canManageTables } = usePermissions()

const { dishPickerOpen, openPicker, onDishPicked } = useAddDishToTable(() => ctx.tenantId)

const editModalOpen = ref(false)
const editModalTable = ref<Table | null>(null)
const editModalIsNew = ref(false)

const qrModalOpen = ref(false)
const qrModalTable = ref<Table | null>(null)
const allTables = computed(() => [...ctx.openTables, ...ctx.closedTables])

const createTable = async () => {
  const tenantId = ctx.tenantId

  if (!tenantId) return

  const n = allTables.value.length + 1
  const created = await api.tables.add(tenantId, { name: `Стол ${n}` })

  if (created) {
    ctx.onTableAdded(created)
    editModalTable.value = created
    editModalIsNew.value = true
    editModalOpen.value = true
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
