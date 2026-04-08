<template>
  <div>
    <div v-if="tableError" class="table-error-root">
    <FsHeading as="h2">Стол недоступен</FsHeading>
    <FsText color="secondary">{{ tableError }}</FsText>
  </div>

  <template v-else-if="tableData">
    <!-- Уведомление об отклонённых позициях -->
    <FsAlert v-if="removedItems.length" type="error" class="removed-alert">
      <div class="removed-info">
        <span class="removed-title">Отклонено: {{ removedItems.map(i => i.dishName).join(', ') }}</span>
        <span class="removed-hint">Подробности у официанта</span>
      </div>
      <FsButton variant="secondary" size="small" @click="dismissRemoved">Ок</FsButton>
    </FsAlert>

    <MenuSection default-view="dishes" :table-mode="true" @table-order="onTableOrder" />

    <SfFab
      :visible="tableStore.itemCount > 0"
      :count="tableStore.itemCount"
      label="Чек"
      :price="`${tableStore.checkTotal} ${currency}`"
      @click="checkOpen = true"
    >
      <template #icon>
        <ClipboardList :size="24" />
      </template>
    </SfFab>
  </template>

  <!-- Bottom sheet чек -->
  <FsDrawer v-model="checkOpen" title="Ваш заказ">
    <div v-if="!tableStore.checkItems.length" class="check-empty">
      <FsText color="secondary">Вы пока ничего не заказали</FsText>
    </div>

    <div v-else class="check-sections">
      <div v-if="pendingItems.length" class="check-section">
        <FsText variant="body-sm" color="secondary" class="section-label">Ожидают подтверждения</FsText>
        <div class="items-list">
          <TableCheckItem v-for="item in pendingItems" :key="item.id" :item="item" status-color="warning" />
        </div>
      </div>

      <div v-if="cookingItems.length" class="check-section">
        <FsText variant="body-sm" color="secondary" class="section-label">Готовится</FsText>
        <div class="items-list">
          <TableCheckItem v-for="item in cookingItems" :key="item.id" :item="item" status-color="info" />
        </div>
      </div>

      <div v-if="readyItems.length" class="check-section">
        <FsText variant="body-sm" color="secondary" class="section-label">Готово</FsText>
        <div class="items-list">
          <TableCheckItem v-for="item in readyItems" :key="item.id" :item="item" status-color="success" />
        </div>
      </div>

    </div>

    <template v-if="tableStore.checkItems.length" #footer>
      <div class="check-footer">
        <div class="check-total">
          <FsText variant="body" :weight="600">Итого</FsText>
          <FsText variant="body" :weight="600">{{ tableStore.checkTotal }} {{ currency }}</FsText>
        </div>
      </div>
    </template>
  </FsDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useAsyncData, useRequestFetch, useNuxtData } from 'nuxt/app'
import { FsHeading, FsText, FsDrawer, FsButton, FsAlert } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'
import { useTableStore, type CheckItem } from '~/stores/table'
import { useToast } from '~/composables/useToast'
import { useCurrency } from '~/composables/useCurrency'
import { useTableRealtime } from '~/composables/useTableRealtime'
import type { CartItem } from '~/stores/cart'
import { ClipboardList } from 'lucide-vue-next'
import SfFab from '~/components/sf/domain/SfFab.vue'
import TableCheckItem from '~/components/table/TableCheckItem.vue'
import MenuSection from '~/components/sections/MenuSection.vue'

definePageMeta({ layout: 'table' })

const route = useRoute()
const rfetch = useRequestFetch()
const tableStore = useTableStore()
const { success: showSuccess, error: showError } = useToast()
const currency = useCurrency()

const tableId = route.params.id as string
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

const checkOpen = ref(false)

// Валидация стола
const tableData = ref<{ id: string; name: string } | null>(null)
const tableError = ref<string | null>(null)

const { data, error } = await useAsyncData(`table-${tableId}`, () =>
  rfetch(`/api/table/${tableId}`, slugQuery),
)

if (error.value) {
  tableError.value = (error.value as { data?: { message?: string } }).data?.message ?? 'Стол не найден'
} else if (data.value) {
  tableData.value = data.value as { id: string; name: string }
  tableStore.setTable(tableData.value.id, tableData.value.name)
}

// Группировка по статусу
const pendingItems = computed(() =>
  tableStore.checkItems.filter(i => i.status === 'pending'),
)
const cookingItems = computed(() =>
  tableStore.checkItems.filter(i =>
    i.status === 'confirmed' && (i.kitchenStatus === 'queued' || i.kitchenStatus === 'in_progress'),
  ),
)
const readyItems = computed(() =>
  tableStore.checkItems.filter(i =>
    i.status === 'confirmed' && (i.kitchenStatus === 'done' || i.kitchenStatus === 'served' || !i.kitchenStatus),
  ),
)

// Загружаем текущий чек
const removedItems = ref<CheckItem[]>([])

async function loadCheck() {
  try {
    const result = await $fetch(`/api/table/${tableId}/check`, slugQuery) as { items: CheckItem[] }
    const oldItems = tableStore.checkItems
    if (oldItems.length > 0) {
      const newIds = new Set(result.items.map(i => i.id))
      const gone = oldItems.filter(i => !newIds.has(i.id))
      if (gone.length) {
        removedItems.value = [...removedItems.value, ...gone]
      }
    }
    tableStore.setCheckItems(result.items)
  } catch {
    // Не критично
  }
}

function dismissRemoved() {
  removedItems.value = []
}

onMounted(() => loadCheck())
const { data: tenant } = useNuxtData<Tenant>('tenant')
useTableRealtime(tenant.value?.id ?? '', loadCheck)

// Заказ блюда
async function onTableOrder(item: CartItem) {
  try {
    await $fetch('/api/orders', {
      method: 'POST',
      ...slugQuery,
      body: {
        deliveryType: 'dine_in',
        tableId,
        paymentType: 'cash',
        customer: {},
        items: [{
          dishId: item.dishId,
          comboId: item.comboId,
          dishName: item.dishName,
          categoryName: item.categoryName,
          price: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers,
          removedIngredients: item.removedIngredients,
          addons: item.addons,
        }],
      },
    })
    showSuccess(`${item.dishName} — отправлено`)
    await loadCheck()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка при заказе'
    showError(message)
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.removed-alert {
  position: fixed;
  bottom: 80px;
  left: 16px;
  right: 16px;
  z-index: 201;
  justify-content: space-between;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.removed-info {
  @include flex-col(2px);
  min-width: 0;
}

.removed-title {
  @include text-caption(600);
}

.removed-hint {
  @include text-xs;
  opacity: 0.7;
}

.table-error-root {
  @include flex-col(8px);
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  text-align: center;
}

.check-empty {
  text-align: center;
  padding: 40px 0;
}

.check-sections {
  @include flex-col(20px);
}

.check-section {
  @include flex-col(8px);
}

.section-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.items-list {
  @include flex-col(4px);
}

.check-footer {
  width: 100%;
}

.check-total {
  display: flex;
  justify-content: space-between;
}
</style>
