<template>
  <div class="queue-root">
    <UiAlert v-if="sourceStatusMissing" type="error" size="small">
      Не настроен статус для отправки заказов на кухню — блюда доставки и самовывоза не попадут в очередь.
      <NuxtLink v-if="canEditSettings" class="alert-link" to="/kitchen/settings">Настроить</NuxtLink>
    </UiAlert>

    <UiAlert v-else-if="completedStatusMissing.length" type="warning" size="small">
      Не настроены статусы завершения для: {{ completedStatusMissing.join(', ') }} — заказы не будут автоматически переходить в следующий статус после приготовления.
      <NuxtLink v-if="canEditSettings" class="alert-link" to="/kitchen/settings">Настроить</NuxtLink>
    </UiAlert>

    <div v-if="loading" class="queue-loading">
      <UiSkeleton :repeat="6" />
    </div>

    <template v-else-if="hasActiveItems">
      <div class="queue-layout">
        <!-- Queue (narrow left panel) -->
        <div class="panel queue-panel">
          <div class="panel-header">
            <UiSectionHeader :title="`Очередь (${filteredQueueItems.length})`" />

            <div v-if="availableCategories.length > 1" class="category-filter">
              <button
                class="cat-chip"
                :class="{ active: !selectedCategories.size }"
                @click="selectedCategories.clear()"
              >Все</button>
              <button
                v-for="cat in availableCategories"
                :key="cat"
                class="cat-chip"
                :class="{ active: selectedCategories.has(cat) }"
                @click="toggleCategory(cat)"
              >{{ cat }}</button>
            </div>
          </div>

          <div class="panel-scroll">
            <div v-if="filteredQueueItems.length" class="queue-list">
              <KitchenQueueItem
                v-for="item in filteredQueueItems"
                :key="item.id"
                :item="item"
                :elapsed="formatKitchenTime(item.createdAt, now)"
                :urgency-level="getUrgencyLevel(item.createdAt, now, urgencyMinutes)"
                @claim="claimDish(item)"
              />
            </div>
            <UiEmpty v-else icon="check" text="Нет блюд в этой категории" />
          </div>
        </div>

        <!-- My dishes (wide right panel) -->
        <div class="panel work-panel">
          <div class="panel-header">
            <UiSectionHeader :title="`Мои блюда (${myItems.length})`" />
          </div>

          <div class="panel-scroll">
            <div v-if="cancelledOnBoard.length" class="cancelled-list">
              <UiCard
                v-for="item in cancelledOnBoard"
                :key="item.id"
                size="small"
                class="cancelled-card"
              >
                <div class="cancelled-row">
                  <span class="cancelled-label">Отменено</span>
                  <span class="cancelled-name">{{ item.dishName }}</span>
                  <UiButton size="small" type="default" @click="dismissCancelled(item)">Ок</UiButton>
                </div>
              </UiCard>
            </div>

            <div v-if="myItems.length" class="work-grid">
              <KitchenWorkCard
                v-for="item in myItems"
                :key="item.id"
                :item="item"
                :elapsed="formatKitchenTime(item.createdAt, now)"
                :cooking-elapsed="formatKitchenTime(item.assignedAt ?? item.createdAt, now)"
                :urgency-level="getUrgencyLevel(item.createdAt, now, urgencyMinutes)"
                :show-delivery-type="hasMultipleDeliveryTypes"
                @complete="completeDish(item)"
                @unclaim="unclaimDish(item)"
              />
            </div>
            <UiEmpty v-else-if="!cancelledOnBoard.length" icon="chefHat" text="Возьмите блюдо из очереди" />
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
import { ref, computed, watch, onUnmounted, reactive } from 'vue'
import { useNow } from '@vueuse/core'
import { UiSkeleton, UiButton, UiEmpty, UiSectionHeader, UiCard, UiAlert } from '@fastio/ui'
import type { KitchenQueueItem as KitchenQueueItemType, OrderEvent } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { useModules } from '~/composables/plan/useModules'
import { usePermissions } from '~/composables/auth/usePermissions'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import KitchenQueueItem from '~/components/kitchen/KitchenQueueItem.vue'
import KitchenWorkCard from '~/components/kitchen/KitchenWorkCard.vue'
import { reportError } from '~/utils/reportError'

const api = useDatabase()
const tenantStore = useTenantStore()
const authStore = useAuthStore()
const modules = useModules()
const { canEditSettings } = usePermissions()
const now = useNow({ interval: 30_000 })

const loading = ref(false)
const error = ref(false)
const items = ref<KitchenQueueItemType[]>([])

const currentUserId = computed(() => authStore.user?.id ?? null)
const urgencyMinutes = computed(() => tenantStore.tenant?.kitchenUrgencyMinutes ?? 15)

const hasMultipleDeliveryTypes = computed(() => {
  const active = [modules.delivery?.value?.active, modules.pickup?.value?.active, modules.dineIn?.value?.active].filter(Boolean)

  return active.length > 1
})

const deliveryActive = computed(() => !!modules.delivery?.value?.active)
const pickupActive = computed(() => !!modules.pickup?.value?.active)
const hasDeliveryOrPickup = computed(() => deliveryActive.value || pickupActive.value)

const sourceStatusMissing = computed(() => hasDeliveryOrPickup.value && !tenantStore.tenant?.kitchenConfig?.sourceStatusId)

const completedStatusMissing = computed(() => {
  const map = tenantStore.tenant?.kitchenConfig?.completedStatusMap
  const missing: string[] = []

  if (deliveryActive.value && !map?.delivery) missing.push('доставки')
  if (pickupActive.value && !map?.pickup) missing.push('самовывоза')

  return missing
})

const queueItems = computed(() => items.value.filter((i) => i.status === 'queued'))
const myItems = computed(() => items.value.filter((i) => i.status === 'in_progress' && i.assignedTo === currentUserId.value))
const cancelledOnBoard = computed(() => items.value.filter((i) => i.status === 'cancelled' && i.assignedTo === currentUserId.value))
const hasActiveItems = computed(() => queueItems.value.length > 0 || myItems.value.length > 0 || cancelledOnBoard.value.length > 0)

// --- Category filter ---

const selectedCategories = reactive(new Set<string>())

const availableCategories = computed(() => {
  const cats = new Set<string>()

  for (const item of queueItems.value) {
    if (item.categoryName) cats.add(item.categoryName)
  }

  return [...cats].sort()
})

const toggleCategory = (cat: string) => {
  if (selectedCategories.has(cat)) selectedCategories.delete(cat)
  else selectedCategories.add(cat)
}

const filteredQueueItems = computed(() => {
  if (!selectedCategories.size) return queueItems.value

  return queueItems.value.filter((i) => i.categoryName && selectedCategories.has(i.categoryName))
})

// --- Helpers ---

const getUrgencyLevel = (createdAt: string, nowDate: Date, thresholdMin: number): 'normal' | 'warning' | 'critical' => {
  const elapsedMin = (nowDate.getTime() - new Date(createdAt).getTime()) / 60_000

  if (elapsedMin >= thresholdMin) return 'critical'
  if (elapsedMin >= thresholdMin * 0.66) return 'warning'

  return 'normal'
}

const formatKitchenTime = (isoDate: string, nowDate: Date): string => {
  const min = Math.floor((nowDate.getTime() - new Date(isoDate).getTime()) / 60_000)

  if (min < 1) return '<1 мин'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  const m = min % 60

  return m > 0 ? `${h}ч ${m}м` : `${h}ч`
}

// --- Load ---

const load = async () => {
  const tenantId = tenantStore.tenant?.id

  if (!tenantId) return

  loading.value = true
  error.value = false
  try {
    items.value = await api.kitchenQueue.listActive(tenantId)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenant?.id, (id) => {
  if (id) load()
}, { immediate: true })

// --- Actions ---

const getActor = () => {
  const user = authStore.user

  if (!user) return null

  return {
    tenantId: tenantStore.tenant?.id ?? '',
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
  await api.kitchenQueue.unclaim(qItem.id)
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

    if (idx !== -1) items.value[idx] = item
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
@use '@fastio/styles/mixins/media-queries' as *;

.queue-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.queue-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.queue-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @include mq-m {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
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
  flex-shrink: 0;
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 4px;
}

// ── Queue panel ──

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cat-chip {
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
}

// ── Cancelled ──

.cancelled-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.cancelled-card {
  border: 1.5px solid var(--color-error);
  background: var(--color-error-bg);
}

.cancelled-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cancelled-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-error);
  flex-shrink: 0;
}

.cancelled-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-title);
  text-decoration: line-through;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── Config alerts ──

.alert-link {
  font-weight: 600;
  margin-left: 4px;
  text-decoration: underline;
  white-space: nowrap;
}

// ── Work panel ──

.work-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-m {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    align-items: start;
  }
}
</style>
