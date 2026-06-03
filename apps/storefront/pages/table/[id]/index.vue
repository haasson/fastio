<template>
  <div>
    <div v-if="tableError" class="table-error-root">
    <FsHeading as="h2">Стол недоступен</FsHeading>
    <FsText color="secondary">{{ tableError }}</FsText>
  </div>

  <template v-else-if="tableData">
    <MenuSection
      default-view="dishes"
      :table-mode="true"
      :order-counts="draftCountByItem"
      @table-order="onTableOrder"
      @table-inc="onTableInc"
      @table-dec="onTableDec"
    />

    <TableOrderBar
      :check-count="tableStore.checkItems.length"
      :check-total="tableStore.checkTotal"
      :draft-count="tableStore.draftCount"
      :draft-total="tableStore.draftTotal"
      @open-check="checkOpen = true"
      @open-draft="draftOpen = true"
    />

    <!-- Резерв под фиксированную нижнюю полосу, чтобы не перекрывала последние блюда -->
    <div v-if="barVisible" class="bar-spacer" aria-hidden="true" />
  </template>

  <!-- Шторка «Заказ»: редактируемый драфт + подтверждение -->
  <FsDrawer v-model="draftOpen" title="Заказ">
    <div v-if="!tableStore.draftItems.length" class="check-empty">
      <FsText color="secondary">Корзина пуста — выберите блюда в меню</FsText>
    </div>

    <div v-else class="items-list">
      <TableDraftItem
        v-for="item in tableStore.draftItems"
        :key="item._key"
        :item="item"
        @inc="tableStore.updateDraftQty(item._key, item.quantity + 1)"
        @dec="tableStore.updateDraftQty(item._key, item.quantity - 1)"
        @remove="tableStore.removeDraftItem(item._key)"
      />
    </div>

    <template v-if="tableStore.draftItems.length" #footer>
      <div class="check-footer">
        <div class="check-total">
          <FsText variant="body" :weight="600">Итого</FsText>
          <FsText variant="body" :weight="600">{{ formatPrice(tableStore.draftTotal) }}</FsText>
        </div>
        <FsButton
          variant="primary"
          :loading="sending"
          responsive
          @click="submitDraft"
        >
          Подтвердить заказ
        </FsButton>
      </div>
    </template>
  </FsDrawer>

  <!-- Шторка «Счёт»: отправленное по статусам, read-only -->
  <FsDrawer v-model="checkOpen" title="Счёт">
    <div v-if="!tableStore.checkItems.length" class="check-empty">
      <FsText color="secondary">Вы пока ничего не заказали</FsText>
    </div>

    <div v-else class="check-sections">
      <!-- Заказанные блюда — сам чек, простой список -->
      <div v-if="readyItems.length" class="check-card">
        <TableCheckItem v-for="item in readyItems" :key="item.id" :item="item" />
      </div>

      <!-- Ещё не готово — выделенный блок -->
      <div v-if="progressItems.length" class="cooking-block">
        <FsText variant="caption" :weight="600" class="cooking-label">Готовится</FsText>
        <div class="cooking-items">
          <TableCheckItem v-for="item in progressItems" :key="item.id" :item="item" />
        </div>
      </div>
    </div>

    <template v-if="tableStore.checkItems.length" #footer>
      <div class="check-footer">
        <div class="check-total">
          <FsText variant="body" :weight="600">Итого заказано</FsText>
          <FsText variant="body" :weight="600">{{ formatPrice(tableStore.checkTotal) }}</FsText>
        </div>
      </div>
    </template>
  </FsDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useAsyncData, useRequestFetch, useNuxtData, useCookie } from 'nuxt/app'
import { FsHeading, FsText, FsDrawer, FsButton } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useTableStore, useTableRealtime, aggregateCheckItems, type CheckItem } from '~/features/table-mode'
import { useToast } from '~/shared/composables/useToast'
import { useBottomInset } from '~/shared/composables/useBottomInset'
import { isDishItem, type CartItem, type DishCartItem } from '~/features/cart'
import { reportError } from '@fastio/shared/observability'
import TableOrderBar from '~/features/table-mode/components/TableOrderBar.vue'
import TableCheckItem from '~/features/table-mode/components/TableCheckItem.vue'
import TableDraftItem from '~/features/table-mode/components/TableDraftItem.vue'
import MenuSection from '~/features/menu-catalog/components/MenuSection.vue'

// TTL cookie `fastio_table` — синхронно с server/api/table/[id].get.ts (PREPROD-263).
const TABLE_COOKIE_MAX_AGE = 6 * 60 * 60

definePageMeta({ layout: 'table' })

const route = useRoute()
const rfetch = useRequestFetch()
const tableStore = useTableStore()
const { success: showSuccess, error: showError, show: showToast } = useToast()

const tableId = route.params.id as string
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

const checkOpen = ref(false)
const draftOpen = ref(false)
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
  aggregateCheckItems(
    tableStore.checkItems.filter(i =>
      i.status === 'confirmed' && (i.kitchenStatus === 'done' || i.kitchenStatus === 'served' || !i.kitchenStatus),
    ),
  ),
)
// «Готовится» = всё, что ещё не готово: ждёт подтверждения официантом + на кухне.
// Дедупим внутри группы — одинаковые блюда одной строкой с суммой (как в админке).
const progressItems = computed(() => aggregateCheckItems([...pendingItems.value, ...cookingItems.value]))

// Нижняя полоса заказа фиксирована — резервируем место, чтобы не перекрывала меню.
const barVisible = computed(() => tableStore.checkItems.length > 0 || tableStore.draftCount > 0)

// Высота полосы → в общий bottom-inset: резерв контента, тосты и алерт встают над ней.
const { register: registerBottomInset } = useBottomInset()
registerBottomInset('table-order-bar', () =>
  barVisible.value ? 'calc(72px + env(safe-area-inset-bottom))' : null,
)

// Загружаем текущий чек
async function loadCheck() {
  try {
    const result = await $fetch(`/api/table/${tableId}/check`, slugQuery) as { items: CheckItem[] }
    const oldItems = tableStore.checkItems
    if (oldItems.length > 0) {
      const newIds = new Set(result.items.map(i => i.id))
      const gone = oldItems.filter(i => !newIds.has(i.id))
      if (gone.length) {
        // Каждая пачка отклонений — отдельный persist-тост; viewport их стекает.
        // Снимается кнопкой «Ок» (provider авто-дисмиссит на action).
        showToast({
          variant: 'error',
          persist: true,
          title: `Отклонено: ${gone.map(i => i.dishName).join(', ')}`,
          description: 'Подробности у официанта',
          action: { label: 'Ок' },
        })
      }
    }
    tableStore.setCheckItems(result.items)
  } catch (e) {
    reportError(e instanceof Error ? e : new Error('[table/[id]] failed to load check'))
  }
}

onMounted(() => {
  // Восстанавливаем несобранный драфт после рефреша (client-only, см. стор).
  tableStore.restoreDraft()
  loadCheck()
})
const { data: tenant } = useNuxtData<Tenant>('tenant')
useTableRealtime(tenant.value?.id ?? '', loadCheck)

// Тап блюда → копим в локальном драфте (без POST). Отправка — batch'ем по кнопке.
// Тост на каждый тап не нужен: нижняя полоса заказа сама растёт — это и есть фидбек.
function onTableOrder(item: CartItem) {
  if (!isDishItem(item)) {
    reportError(new Error(`[table/[id]] expected dish item, got kind=${item.kind}`))
    return
  }
  tableStore.addDraftItem(item)
}

// Каунтер на карточке блюда: кол-во в драфте по dishId/comboId + первый _key
// для +/- (как в корзине доставки — стрелки двигают первую найденную позицию).
const draftCountByItem = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const i of tableStore.draftItems) {
    const key = i.comboId ?? i.dishId
    if (!key) continue
    map[key] = (map[key] ?? 0) + i.quantity
  }
  return map
})

const firstDraftKeyByItem = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const i of tableStore.draftItems) {
    const key = i.comboId ?? i.dishId
    if (!key || key in map) continue
    map[key] = i._key
  }
  return map
})

function onTableInc(key: string) {
  const draftKey = firstDraftKeyByItem.value[key]
  const item = tableStore.draftItems.find(i => i._key === draftKey)
  if (item) tableStore.updateDraftQty(item._key, item.quantity + 1)
}

function onTableDec(key: string) {
  const draftKey = firstDraftKeyByItem.value[key]
  const item = tableStore.draftItems.find(i => i._key === draftKey)
  if (item) tableStore.updateDraftQty(item._key, item.quantity - 1)
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
    draftOpen.value = false
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
  @include flex-col(16px);
}

.items-list {
  @include flex-col(6px);
}

// Чек — нейтральная карточка, строки разделены тонкой линией.
.check-card {
  padding: 2px 14px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  border: 1px solid var(--color-border);

  > * + * {
    border-top: 1px solid var(--color-border);
  }
}

// Блок «Готовится» — слегка выделен амбер-тинтом.
.cooking-block {
  @include flex-col(4px);
  padding: 10px 14px 6px;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent);
}

.cooking-items > * + * {
  border-top: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
}

.cooking-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-warning);
}

.bar-spacer {
  height: var(--app-bottom-inset, 0px);
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
