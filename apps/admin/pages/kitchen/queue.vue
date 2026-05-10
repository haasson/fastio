<template>
  <div class="queue-root" data-tour="kitchen-queue">
    <UiAlert v-if="sourceStatusMissing" type="error" size="small">
      Не настроен статус для отправки заказов на кухню — блюда доставки и самовывоза не попадут в очередь.
      <NuxtLink v-if="gate.editSettings.value.enabled" class="alert-link" to="/kitchen/settings">Настроить</NuxtLink>
    </UiAlert>

    <UiAlert v-else-if="completedStatusMissing.length" type="warning" size="small">
      Не настроены статусы завершения для: {{ completedStatusMissing.join(', ') }} — заказы не будут автоматически переходить в следующий статус после приготовления.
      <NuxtLink v-if="gate.editSettings.value.enabled" class="alert-link" to="/kitchen/settings">Настроить</NuxtLink>
    </UiAlert>

    <UiSelect
      v-if="!loading && categoryOptions.length > 1"
      v-model:value="selectedCategories"
      multiple
      :options="categoryOptions"
      placeholder="Мои категории (все)"
      class="category-select"
      clearable
      data-tour="kitchen-queue-filter"
    />

    <div v-if="loading" class="queue-loading">
      <UiSkeleton :repeat="6" />
    </div>

    <template v-else-if="hasContent">
      <div class="queue-layout">
        <!-- Left panel: Queue -->
        <div class="panel queue-panel" data-tour="kitchen-queue-panel">
          <div class="panel-header">
            <UiSectionHeader :title="`Очередь (${filteredQueueItems.length})`" />
          </div>

          <div class="panel-scroll">
            <div v-if="filteredQueueItems.length" class="queue-list">
              <KitchenQueueItem
                v-for="item in filteredQueueItems"
                :key="item.id"
                :item="item"
                data-tour="kitchen-queue-item"
                :elapsed="formatKitchenTime(item.createdAt, now)"
                :urgency-level="getUrgencyLevel(item.createdAt, now, urgencyMinutes)"
                @claim="claimDish(item)"
              />
            </div>
            <UiEmpty v-else icon="check" text="Нет блюд в этой категории" />
          </div>
        </div>

        <!-- My dishes (wide right panel) -->
        <div class="panel work-panel" data-tour="kitchen-work-panel">
          <div class="panel-header">
            <UiSectionHeader :title="`Мои блюда (${myItems.length})`" />
          </div>

          <div class="panel-scroll">
            <div v-if="myItems.length || cancelledOnBoard.length" class="work-grid">
              <KitchenWorkCard
                v-for="item in cancelledOnBoard"
                :key="item.id"
                :item="item"
                data-tour="kitchen-work-card"
                :elapsed="formatKitchenTime(item.createdAt, now)"
                :cooking-elapsed="formatKitchenTime(item.assignedAt ?? item.createdAt, now)"
                :urgency-level="'normal'"
                :show-delivery-type="false"
                :cancelled="true"
                @dismiss="dismissCancelled(item)"
              />
              <KitchenWorkCard
                v-for="item in myItems"
                :key="item.id"
                :item="item"
                data-tour="kitchen-work-card"
                :elapsed="formatKitchenTime(item.createdAt, now)"
                :cooking-elapsed="formatKitchenTime(item.assignedAt ?? item.createdAt, now)"
                :urgency-level="getUrgencyLevel(item.createdAt, now, urgencyMinutes)"
                :show-delivery-type="hasMultipleDeliveryTypes"
                @complete="completeDish(item)"
                @unclaim="unclaimDish(item)"
              />
            </div>
            <UiEmpty v-else icon="chefHat" text="Возьмите блюдо из очереди" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <UiEmpty icon="warningRound" text="Не удалось загрузить очередь" />
      <UiButton type="default" @click="load">Повторить</UiButton>
    </template>

    <UiEmpty v-else icon="chefHat" text="Очередь пуста" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useNow } from '@vueuse/core'
import { UiSkeleton, UiEmpty, UiSectionHeader, UiAlert, UiSelect, UiButton } from '@fastio/ui'
import type { KitchenQueueItem as KitchenQueueItemType, OrderEvent } from '@fastio/shared'
import { isAutoCategory, getKitchenUrgencyLevel, formatKitchenElapsed } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { useGate } from '~/composables/plan/useGate'
import { kitchenQueueEvents } from '~/features/kitchen'
import KitchenQueueItem from '~/features/kitchen/components/KitchenQueueItem.vue'
import KitchenWorkCard from '~/features/kitchen/components/KitchenWorkCard.vue'
import { reportError } from '~/utils/reportError'
import { mergeRealtimeItem } from '~/features/kitchen'

const api = useDatabase()
const tenantStore = useTenantStore()
const authStore = useAuthStore()
const gate = useGate()
const now = useNow({ interval: 30_000 })

const loading = ref(false)
const error = ref(false)
const items = ref<KitchenQueueItemType[]>([])

const currentUserId = computed(() => authStore.user?.id ?? null)
const urgencyMinutes = computed(() => tenantStore.tenant.kitchenUrgencyMinutes ?? 15)

const hasMultipleDeliveryTypes = computed(() => {
  const active = [gate.delivery.value.enabled, gate.pickup.value.enabled, gate.dineIn.value.enabled].filter(Boolean)

  return active.length > 1
})

const deliveryActive = computed(() => gate.delivery.value.enabled)
const pickupActive = computed(() => gate.pickup.value.enabled)
const hasDeliveryOrPickup = computed(() => deliveryActive.value || pickupActive.value)

// kitchenAutoStatus сам учитывает kitchen-доступ + источник.
// sourceStatusMissing срабатывает только когда у тенанта есть delivery/pickup и не настроен source статус.
const sourceStatusMissing = computed(() => hasDeliveryOrPickup.value && gate.kitchenAutoStatus.value.reason === 'unconfigured')

const completedStatusMissing = computed(() => {
  const map = tenantStore.tenant.kitchenConfig?.completedStatusMap
  const missing: string[] = []

  if (deliveryActive.value && !map?.delivery) missing.push('доставки')
  if (pickupActive.value && !map?.pickup) missing.push('самовывоза')

  return missing
})

const queueItems = computed(() => items.value.filter((i) => i.status === 'queued'))
const myItems = computed(() => items.value.filter((i) => i.status === 'in_progress' && i.assignedTo === currentUserId.value))
const cancelledOnBoard = computed(() => items.value.filter((i) => i.status === 'cancelled' && i.assignedTo === currentUserId.value))
const hasContent = computed(() => queueItems.value.length > 0 || myItems.value.length > 0 || cancelledOnBoard.value.length > 0)

// --- Category filter (persisted per user) ---

const filterStorageKey = computed(() => `kitchen-filter-${currentUserId.value ?? 'anon'}`)

const loadSavedFilter = (): string[] => {
  try {
    const raw = localStorage.getItem(filterStorageKey.value)

    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const selectedCategories = ref<string[]>(loadSavedFilter())

watch(filterStorageKey, () => {
  selectedCategories.value = loadSavedFilter()
})

watch(selectedCategories, (val) => {
  try {
    localStorage.setItem(filterStorageKey.value, JSON.stringify(val))
  } catch { /* ignore */ }
})

// Active regular categories from menu (no combos, no special types)
const allCategories = ref<string[]>([])

const loadCategories = async () => {
  try {
    const cats = await api.categories.list(tenantStore.tenant.id)

    allCategories.value = cats
      .filter((c) => c.active && c.type === 'regular' && !isAutoCategory(c))
      .map((c) => c.name)
      .sort()
  } catch (e) {
    reportError(e)
  }
}

watch(() => tenantStore.tenant.id, () => {
  loadCategories()
}, { immediate: true })

const categoryOptions = computed(() => allCategories.value.map((name) => ({ label: name, value: name })))

const filteredQueueItems = computed(() => {
  if (!selectedCategories.value.length) return queueItems.value

  const selected = new Set(selectedCategories.value)

  return queueItems.value.filter((i) => i.categoryName && selected.has(i.categoryName))
})

// --- Helpers ---

const getUrgencyLevel = getKitchenUrgencyLevel
const formatKitchenTime = formatKitchenElapsed

// --- Load ---

const load = async () => {
  loading.value = true
  error.value = false
  try {
    items.value = await api.kitchenQueue.listActive(tenantStore.tenant.id)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenant.id, () => {
  load()
}, { immediate: true })

// --- Actions ---

const getActor = () => {
  const user = authStore.user

  if (!user) return null

  return {
    tenantId: tenantStore.tenant.id,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email || null,
    actorRole: tenantStore.currentRoleName ?? null,
  }
}

const logKitchenEvent = async (orderId: string, eventType: string, meta: Record<string, unknown>) => {
  const actor = getActor()

  if (!actor) return
  await api.orderEvents.add({ orderId, ...actor, eventType: eventType as OrderEvent['eventType'], meta }).catch(reportError)
}

const claimDish = async (qItem: KitchenQueueItemType) => {
  if (!currentUserId.value) return
  const item = items.value.find((i) => i.id === qItem.id)

  if (item) {
    item.status = 'in_progress'
    item.assignedTo = currentUserId.value
    item.assignedAt = new Date().toISOString()
  }
  await api.kitchenQueue.claim(qItem.id, currentUserId.value)
  logKitchenEvent(qItem.orderId, 'kitchen_claimed', { dishName: qItem.dishName, queueItemId: qItem.id })
}

const completeDish = async (qItem: KitchenQueueItemType) => {
  items.value = items.value.filter((i) => i.id !== qItem.id)
  logKitchenEvent(qItem.orderId, 'kitchen_completed', { dishName: qItem.dishName, queueItemId: qItem.id })
  await api.kitchenQueue.complete(qItem.id)
}

const unclaimDish = async (qItem: KitchenQueueItemType) => {
  const item = items.value.find((i) => i.id === qItem.id)

  if (item) {
    item.status = 'queued'
    item.assignedTo = null
    item.assignedAt = null
  }
  await api.kitchenQueue.unclaim(qItem.id)
  logKitchenEvent(qItem.orderId, 'kitchen_returned', { dishName: qItem.dishName, queueItemId: qItem.id })
}

const dismissCancelled = async (qItem: KitchenQueueItemType) => {
  items.value = items.value.filter((i) => i.id !== qItem.id)
  await api.kitchenQueue.dismissCancelled(qItem.id)
}

// --- Realtime ---

const offInsert = kitchenQueueEvents.onInsert((item) => {
  if (item.status === 'queued' || item.status === 'in_progress') {
    if (!items.value.some((i) => i.id === item.id)) {
      items.value.push(item)
    }
  }
})

const offUpdate = kitchenQueueEvents.onUpdate((item) => {
  // Cancelled without assignee (was in queue) — just remove
  if (item.status === 'cancelled' && !item.assignedTo) {
    items.value = items.value.filter((i) => i.id !== item.id)

    return
  }

  if (item.status === 'queued' || item.status === 'in_progress' || item.status === 'cancelled') {
    const idx = items.value.findIndex((i) => i.id === item.id)

    if (idx !== -1) items.value[idx] = mergeRealtimeItem(item, items.value[idx])
    else items.value.push(item)
  } else {
    items.value = items.value.filter((i) => i.id !== item.id)
  }
})

const offDelete = kitchenQueueEvents.onDelete(({ id }) => {
  items.value = items.value.filter((i) => i.id !== id)
})

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.queue-root {
  @include flex-col(var(--space-12));
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.queue-loading {
  @include flex-col(var(--space-12));
}

.queue-layout {
  @include flex-col(var(--space-16));
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @include mq-m {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--space-20);
  }
}

// ── Shared panel structure ──

.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-header {
  @include flex-col;
  flex-shrink: 0;
  padding-bottom: var(--space-8);
}

.panel-scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: var(--space-4);
}

// ── Queue panel ──

.queue-list {
  @include flex-col(var(--space-4));
}

.category-select {
  width: 100%;
}

// ── Config alerts ──

.alert-link {
  font-weight: var(--font-weight-semibold);
  margin-left: var(--space-4);
  text-decoration: underline;
  white-space: nowrap;
}

// ── Work panel ──

.work-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    align-items: start;
  }
}
</style>
