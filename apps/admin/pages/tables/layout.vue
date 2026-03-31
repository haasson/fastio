<template>
  <div>
    <TablesCanvas
      :tables="ctx.tables"
      :today-reservations="todayReservations"
      @update="ctx.onTableUpdated"
      @update-position="ctx.onPositionUpdated"
      @edit-table="openEdit"
    />

    <TableEditModal
      v-model="editModalOpen"
      :table="editModalTable"
      @updated="ctx.onTableUpdated"
      @deleted="ctx.onTableDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { Table } from '@fastio/shared'
import { useTablesContext, TodayReservationsKey } from '~/composables/ui/useTablesContext'
import TablesCanvas from '~/components/tables/TablesCanvas.vue'
import TableEditModal from '~/components/tables/TableEditModal.vue'

const ctx = useTablesContext()
const todayReservations = inject(TodayReservationsKey, computed(() => []))

const editModalOpen = ref(false)
const editModalTable = ref<Table | null>(null)

const openEdit = (table: Table) => {
  editModalTable.value = table
  editModalOpen.value = true
}
</script>
