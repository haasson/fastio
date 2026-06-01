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
      :visible="fabVisible"
      :count="fabCount"
      label="Заказ"
      :price="formatPrice(fabTotal)"
      @click="checkOpen = true"
    >
      <template #icon>
        <ClipboardList :size="24" />
      </template>
    </SfFab>
  </template>

  <!-- Bottom sheet: новый заказ (драфт) + уже отправленный чек -->
  <FsDrawer v-model="checkOpen" title="Ваш заказ">
    <div v-if="!tableStore.draftItems.length && !tableStore.checkItems.length" class="check-empty">
      <FsText color="secondary">Вы пока ничего не выбрали</FsText>
    </div>

    <div v-else class="check-sections">
      <!-- Новый заказ: редактируемый драфт, ещё не отправлен на кухню -->
      <div v-if="tableStore.draftItems.length" class="check-section">
        <FsText variant="body-sm" color="secondary" class="section-label">Новый заказ</FsText>
        <div class="items-list">
          <TableDraftItem
            v-for="item in tableStore.draftItems"
            :key="item._key"
            :item="item"
            @inc="tableStore.updateDraftQty(item._key, item.quantity + 1)"
            @dec="tableStore.updateDraftQty(item._key, item.quantity - 1)"
            @remove="tableStore.removeDraftItem(item._key)"
          />
        </div>
      </div>

      <!-- Уже заказано: read-only, по статусам с кухни -->
      <template v-if="tableStore.checkItems.length">
        <FsText
          v-if="tableStore.draftItems.length"
          variant="body-sm"
          color="secondary"
          class="section-label section-label-group"
        >
          Уже заказано
        </FsText>

        <div v-if="pendingItems.length" class="check-section">
          <FsText variant="caption" color="secondary" class="section-label">Ожидают подтверждения</FsText>
          <div class="items-list">
            <TableCheckItem v-for="item in pendingItems" :key="item.id" :item="item" status-color="warning" />
          </div>
        </div>

        <div v-if="cookingItems.length" class="check-section">
          <FsText variant="caption" color="secondary" class="section-label">Готовится</FsText>
          <div class="items-list">
            <TableCheckItem v-for="item in cookingItems" :key="item.id" :item="item" status-color="info" />
          </div>
        </div>

        <div v-if="readyItems.length" class="check-section">
          <FsText variant="caption" color="secondary" class="section-label">Готово</FsText>
          <div class="items-list">
            <TableCheckItem v-for="item in readyItems" :key="item.id" :item="item" status-color="success" />
          </div>
        </div>
      </template>
    </div>

    <template v-if="tableStore.draftItems.length || tableStore.checkItems.length" #footer>
      <div class="check-footer">
        <div v-if="tableStore.draftItems.length" class="check-total">
          <FsText variant="body" :weight="600">К отправке</FsText>
          <FsText variant="body" :weight="600">{{ formatPrice(tableStore.draftTotal) }}</FsText>
        </div>
        <div v-else class="check-total">
          <FsText variant="body" :weight="600">Итого заказано</FsText>
          <FsText variant="body" :weight="600">{{ formatPrice(tableStore.checkTotal) }}</FsText>
        </div>
        <FsButton
          v-if="tableStore.draftItems.length"
          variant="primary"
          :loading="sending"
          responsive
          @click="submitDraft"
        >
          Отправить заказ
        </FsButton>
      </div>
    </template>
  </FsDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useAsyncData, useRequestFetch, useNuxtData, useCookie } from 'nuxt/app'
import { FsHeading, FsText, FsDrawer, FsButton, FsAlert } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useTableStore, useTableRealtime, type CheckItem } from '~/features/table-mode'
import { useToast } from '~/shared/composables/useToast'
import { isDishItem, type CartItem, type DishCartItem } from '~/features/cart'
import { reportError } from '@fastio/shared/observability'
import { ClipboardList } from 'lucide-vue-next'
import SfFab from '~/shared/ui/sf/domain/SfFab.vue'
import TableCheckItem from '~/features/table-mode/components/TableCheckItem.vue'
import TableDraftItem from '~/features/table-mode/components/TableDraftItem.vue'
import MenuSection from '~/features/menu-catalog/components/MenuSection.vue'

// TTL cookie `fastio_table` — синхронно с server/api/table/[id].get.ts (PREPROD-263).
const TABLE_COOKIE_MAX_AGE = 6 * 60 * 60

definePageMeta({ layout: 'table' })

const route = useRoute()
const rfetch = useRequestFetch()
const tableStore = useTableStore()
const { success: showSuccess, error: showError } = useToast()

const tableId = route.params.id as string
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

const checkOpen = ref(false)
const sending = ref(false)

// Idempotency ключ заказа. Один ключ на «логическую» отправку: при ретрае ПОСЛЕ
// сетевой ошибки (POST дошёл, ответ — нет) повторный клик переиспользует тот же
// ключ → сервер не плодит дубль заказа на кухню (orders.post.ts ловит 23505).
// При ЛЮБОМ изменении драфта ключ сбрасывается — другой состав = другой заказ.
const pendingOrderKey = ref<string | null>(null)

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

  // Single source of truth для cookie `fastio_table`. setCookie внутри
  // GET /api/table/[id] на SSR — это под-запрос, его Set-Cookie НЕ долетает до
  // браузера (Nuxt-готча), из-за чего POST /call → 403 и GET /check → 404 на
  // свежем QR-заходе. useCookie SSR-aware: реально ставит cookie и на SSR, и на
  // client-nav. Значение === tableId (не секрет — это id стола). Серверный guard
  // читает её через getCookie независимо от httpOnly. Mismatch-спам в [id].get.ts
  // не триггерится: на свежем заходе входящей cookie нет, а на ре-заходе значение
  // совпадает (rfetch форвардит cookie в под-запрос).
  useCookie('fastio_table', {
    maxAge: TABLE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  }).value = tableId
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
  } catch (e) {
    reportError(e instanceof Error ? e : new Error('[table/[id]] failed to load check'))
  }
}

function dismissRemoved() {
  removedItems.value = []
}

onMounted(() => loadCheck())
const { data: tenant } = useNuxtData<Tenant>('tenant')
useTableRealtime(tenant.value?.id ?? '', loadCheck)

// FAB виден когда есть что показать (драфт ИЛИ отправленный чек).
// Счётчик/сумма показывают то, что гость сейчас собирает (драфт); если драфт
// пуст — fallback на отправленный чек.
const fabVisible = computed(() => tableStore.draftCount > 0 || tableStore.itemCount > 0)
const fabCount = computed(() =>
  tableStore.draftCount > 0 ? tableStore.draftCount : tableStore.itemCount,
)
const fabTotal = computed(() =>
  tableStore.draftCount > 0 ? tableStore.draftTotal : tableStore.checkTotal,
)

// Тап блюда → копим в локальном драфте (без POST). Отправка — batch'ем по кнопке.
function onTableOrder(item: CartItem) {
  if (!isDishItem(item)) {
    reportError(new Error(`[table/[id]] expected dish item, got kind=${item.kind}`))
    return
  }
  tableStore.addDraftItem(item)
  showSuccess(`${item.dishName} — добавлено в заказ`)
}

// Любое изменение состава драфта = новая «логическая» отправка → сбрасываем ключ.
watch(() => tableStore.draftItems, () => { pendingOrderKey.value = null }, { deep: true })

// Отправка всего драфта одним заказом.
async function submitDraft() {
  if (sending.value || !tableStore.draftItems.length) return
  sending.value = true

  // Snapshot отправляемых позиций: пока POST в полёте, гость может добавить ещё
  // блюдо — после успеха удаляем РОВНО эти `_key`, а не весь драфт (иначе теряем
  // добавленное во время await). Ключ генерим лениво и переиспользуем при ретрае.
  if (!pendingOrderKey.value) pendingOrderKey.value = crypto.randomUUID()
  const idempotencyKey = pendingOrderKey.value
  const sentKeys = new Set(tableStore.draftItems.map(i => i._key))
  const items = tableStore.draftItems.map((item: DishCartItem) => ({
    dishId: item.dishId,
    comboId: item.comboId,
    dishName: item.dishName,
    categoryName: item.categoryName,
    price: item.price,
    quantity: item.quantity,
    modifiers: item.modifiers,
    removedIngredients: item.removedIngredients,
    addons: item.addons,
  }))

  try {
    await $fetch('/api/orders', {
      method: 'POST',
      ...slugQuery,
      body: {
        deliveryType: 'dine_in',
        tableId,
        paymentType: 'cash',
        customer: {},
        idempotencyKey,
        items,
      },
    })
    tableStore.removeDraftByKeys(sentKeys)
    pendingOrderKey.value = null
    await loadCheck()
    showSuccess('Заказ отправлен')
  } catch (err: unknown) {
    reportError(err instanceof Error ? err : new Error('[table/[id]] failed to send table order'))
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка при заказе'
    showError(message)
  } finally {
    sending.value = false
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
  // Тост-стиль уведомление: над контентом и sticky-header.
  z-index: var(--z-toast);
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

.section-label-group {
  margin-top: 4px;
}

.items-list {
  @include flex-col(4px);
}

.check-footer {
  @include flex-col(12px);
  width: 100%;
}

.check-total {
  display: flex;
  justify-content: space-between;
}
</style>
