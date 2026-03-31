<template>
  <div class="list-root">
    <UiTag v-if="ctx.totalReadyCount > 0" type="success" round>
      {{ ctx.totalReadyCount }} {{ ctx.totalReadyCount === 1 ? 'блюдо готово' : 'блюд готово' }} к подаче
    </UiTag>

    <UiSkeleton v-if="ctx.loading" :repeat="6" />

    <template v-else>
      <div class="list-header">
        <UiButton
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
              @add-dish="addDish(table)"
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
import { UiButton, UiEmpty, UiSkeleton, UiSectionHeader, UiTag, useMessage } from '@fastio/ui'
import type { Table, OrderItem } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuthStore } from '~/stores/auth'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useTablesContext } from '~/composables/ui/useTablesContext'
import DishPickerModal, { type DishPickerResult } from '~/components/menu/DishPickerModal.vue'
import TableCard from '~/components/tables/TableCard.vue'
import TableEditModal from '~/components/tables/TableEditModal.vue'
import TableQrModal from '~/components/tables/TableQrModal.vue'

const ctx = useTablesContext()

const api = useDatabase()
const authStore = useAuthStore()
const orderStatusesStore = useOrderStatusesStore()
const userId = computed(() => authStore.user?.id ?? null)
const { statuses } = storeToRefs(orderStatusesStore)
const { warning } = useMessage()

const dishPickerOpen = ref(false)
const dishPickerTable = ref<Table | null>(null)

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

const addDish = (table: Table) => {
  dishPickerTable.value = table
  dishPickerOpen.value = true
}

const onDishPicked = async (result: DishPickerResult) => {
  const table = dishPickerTable.value
  const tenantId = ctx.tenantId

  if (!table || !tenantId) return

  const newStatusId = statuses.value.find((s) => s.groupType === 'new')?.id

  if (!newStatusId) {
    warning('Статусы заказов не загружены, попробуйте ещё раз')

    return
  }

  dishPickerOpen.value = false

  const modifiersDelta = (result.modifiers ?? []).reduce((sum, m) => sum + (m.priceDelta ?? 0), 0)
  const addonsDelta = (result.addons ?? []).reduce((sum, a) => sum + (a.price ?? 0), 0)
  const totalPrice = result.price + modifiersDelta + addonsDelta

  const item: OrderItem = {
    dishId: result.dishId,
    comboId: result.comboId ?? null,
    dishName: result.dishName,
    categoryName: result.categoryName,
    price: totalPrice,
    quantity: 1,
    removedIngredients: result.removedIngredients,
    modifiers: result.modifiers,
    addons: result.addons,
    completedAt: null,
    comboItems: null,
    addedBy: userId.value,
    confirmedBy: userId.value,
    status: 'confirmed' as const,
  }

  await api.orders.create({
    tenantId,
    branchId: null,
    customerName: null,
    customerPhone: '',
    items: [item],
    deliveryType: 'dine_in',
    address: null,
    comment: null,
    promoCode: null,
    discountAmount: 0,
    subtotal: totalPrice,
    deliveryFee: 0,
    total: totalPrice,
    status: newStatusId,
    paymentType: 'cash',
    tableId: table.id,
    tableName: table.name,
  })
}
</script>

<style scoped lang="scss">
.list-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.list-header {
  display: flex;
  justify-content: flex-end;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 340px));
  gap: 12px;
}
</style>
