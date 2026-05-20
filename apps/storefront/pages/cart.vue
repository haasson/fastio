<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Корзина">
        <div v-if="!cart.restored" class="cart-loading">
          <FsSpinner size="large" />
        </div>

        <SfEmptyState
          v-else-if="cart.count === 0"
          title="Корзина пуста"
          :description="emptyDescription"
          size="lg"
        >
          <ShoppingCart />
          <template #action>
            <FsButton @click="navigateTo('/')">{{ emptyActionLabel }}</FsButton>
          </template>
        </SfEmptyState>

        <div v-else class="cart-layout">
          <div class="cart-items">
            <CartLineItem
              v-for="item in cart.dishItems"
              :key="item._key"
              :item="item"
              :index="globalIndex(item._key)"
              :can-edit="canEditDish(item.dishId)"
              @change="onChange"
              @remove="onRemove"
              @edit="openEdit"
            />
            <CartLineItem
              v-for="item in cart.serviceItems"
              :key="item._key"
              :item="item"
              :index="globalIndex(item._key)"
              :resources="resourcesMap.get(item.serviceId) ?? []"
              :can-edit="(resourcesMap.get(item.serviceId) ?? []).length > 0"
              @remove="onRemoveService"
              @edit="onEditService"
            />
          </div>

          <aside class="cart-sidebar">
            <CartBranchStatus v-if="cart.dishItems.length" />
            <FsCard v-if="cart.dishItems.length" class="summary-card">
              <div class="summary-body">
                <FsAlert v-if="closedStatus" type="warning" :icon="Clock" class="closed-alert">
                  Мы сейчас не работаем. Откроемся {{ closedStatus.day }} в {{ closedStatus.time }}
                </FsAlert>
                <FsAlert v-else-if="branchLoadError" type="muted" class="closed-alert">
                  Не удалось проверить время работы
                </FsAlert>
                <div class="summary-row">
                  <FsText as="span" variant="body-sm" class="summary-label">Сумма заказа</FsText>
                  <FsText as="span" variant="body" :weight="700" class="summary-total">{{ formatPrice(cart.dishSubtotal) }}</FsText>
                </div>
                <FsButton
                  size="large"
                  class="checkout-btn"
                  data-testid="cart-checkout-btn"
                  :disabled="!!closedStatus && !schedulingEnabled"
                  @click="navigateTo('/checkout')"
                >
                  Оформить заказ
                </FsButton>
              </div>
            </FsCard>

            <FsCard v-if="cart.serviceItems.length" class="summary-card">
              <div class="summary-body">
                <div class="summary-row">
                  <FsText as="span" variant="body-sm" class="summary-label">Время</FsText>
                  <FsText as="span" variant="body-sm" :weight="600">{{ cart.totalServiceDuration }} мин</FsText>
                </div>
                <div v-if="cart.serviceSubtotal > 0" class="summary-row">
                  <FsText as="span" variant="body-sm" class="summary-label">Стоимость</FsText>
                  <FsText as="span" variant="body" :weight="700" class="summary-total">{{ formatPrice(cart.serviceSubtotal) }}</FsText>
                </div>
                <FsButton size="large" class="checkout-btn" data-testid="cart-services-checkout-btn" @click="navigateTo('/appointments/checkout')">
                  Подобрать время
                </FsButton>
                <FsButton variant="ghost" size="small" class="request-btn" @click="navigateTo('/appointments/checkout?request=1')">
                  Записаться без выбора времени
                </FsButton>
              </div>
            </FsCard>
          </aside>
        </div>
      </StorePageLayout>
    </FsSection>

    <SfProductModal
      v-if="editState.item"
      :key="editKey"
      v-model="editState.open"
      :title="editState.item.name"
      :photo="editState.item.photos[0] ?? null"
      :description="editState.item.longDescription || editState.item.description || null"
    >
      <DishModalBody
        mode="edit"
        :item="editState.item"
        :modifiers="editState.modifiers"
        :addons="editState.addons"
        :max-addons="editState.maxAddons"
        :initial-quantity="editState.initialQuantity"
        :initial-removed-ingredients="editState.initialRemovedIngredients"
        :initial-modifiers="editState.initialModifiers"
        :initial-addon-ids="editState.initialAddonIds"
        @edit="onItemEdited"
        @close="editState.open = false"
      />
    </SfProductModal>

    <SfProductModal
      v-if="editServiceInfo"
      v-model="showServiceModal"
      :title="editServiceInfo.name"
      :photo="editServiceInfo.photos[0] ?? null"
      :description="editServiceInfo.longDescription || editServiceInfo.description || null"
    >
      <template #meta>
        <div class="service-meta">
          <FsText as="span" variant="caption">{{ editServiceInfo.duration }} мин</FsText>
          <FsText v-if="editServiceInfo.price" as="span" variant="caption" :weight="700" class="meta-price">{{ formatPrice(editServiceInfo.price) }}</FsText>
        </div>
        <BranchAvailabilityHint :branch-ids="editServiceInfo.branchIds" />
      </template>
      <ServiceModalBody
        :key="editServiceInfo.id"
        :service="editServiceInfo"
        :is-edit="true"
        @close="showServiceModal = false"
      />
    </SfProductModal>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { navigateTo, useNuxtData } from 'nuxt/app'
import { ShoppingCart, Clock } from 'lucide-vue-next'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { isOpenNow, DEFAULT_TIMEZONE, formatPrice } from '@fastio/shared'
import { useStorefrontTerms } from '~/shared/composables/useStorefrontTerms'
import { useCartStore, type ServiceCartItem } from '~/features/cart'
import { useMenuStore } from '~/features/menu-catalog'
import { useServicesStore } from '~/features/services-catalog'
import { useCartEdit } from '~/features/cart'
import { reportError } from '@fastio/shared/observability'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import { FsSection, FsButton, FsSpinner, FsCard, FsAlert, FsText } from '@fastio/public-ui'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import CartLineItem from '~/features/cart/components/CartLineItem.vue'
import CartBranchStatus from '~/features/cart/components/CartBranchStatus.vue'
import SfProductModal from '~/shared/ui/sf/domain/SfProductModal.vue'
import DishModalBody from '~/features/menu-catalog/components/DishModalBody.vue'
import ServiceModalBody from '~/features/services-catalog/components/ServiceModalBody.vue'
import BranchAvailabilityHint from '~/features/branch/components/BranchAvailabilityHint.vue'

const { menu, item: itemTerm } = useStorefrontTerms()
const cart = useCartStore()
const menuStore = useMenuStore()
const servicesStore = useServicesStore()
const { editKey, editState, openEdit, onItemEdited } = useCartEdit()

const { data: tenant } = useNuxtData<Tenant>('tenant')

const schedulingEnabled = computed(() => tenant.value?.orderSchedulingConfig?.enabled ?? false)
const hasOrdering = computed(() => !!tenant.value?.orderingEnabled)
const hasServices = computed(() => !!tenant.value?.modules?.services)

const emptyDescription = computed(() => {
  if (hasOrdering.value && hasServices.value) return 'Добавьте товары или услуги'
  if (hasServices.value) return 'Добавьте услуги из каталога'
  return `Добавьте ${itemTerm.value.plural.nom} из нашего ${menu.value.gen}`
})

const emptyActionLabel = computed(() =>
  hasOrdering.value ? `В ${menu.value.acc}` : 'К услугам',
)

type BranchScheduleInfo = { id: string; workingHoursSchedule: WorkingHoursSchedule | null }
const branchSchedules = ref<BranchScheduleInfo[]>([])
const branchLoadError = ref(false)

const closedStatus = computed(() => {
  const tz = tenant.value?.timezone ?? DEFAULT_TIMEZONE
  const schedules = branchSchedules.value
  if (schedules.length === 0) return null

  let earliest: { day: string; time: string; offsetDays: number } | null = null
  for (const branch of schedules) {
    const result = isOpenNow(branch.workingHoursSchedule, tz)
    if (result.open) return null
    if (result.nextChange && (!earliest
      || result.nextChange.offsetDays < earliest.offsetDays
      || (result.nextChange.offsetDays === earliest.offsetDays && result.nextChange.time < earliest.time))) {
      earliest = result.nextChange
    }
  }
  return earliest
})

const resourcesMap = ref(new Map<string, Array<{ id: string; name: string }>>())
const editServiceItem = ref<ServiceCartItem | null>(null)
const showServiceModal = ref(false)

const editServiceInfo = computed(() => {
  const it = editServiceItem.value
  if (!it) return null
  const full = servicesStore.allServices.find((s) => s.id === it.serviceId)
  return {
    id: it.serviceId,
    name: it.serviceName,
    price: it.price,
    duration: it.duration,
    photos: it.photo ? [it.photo] : [],
    allowResourceChoice: it.allowResourceChoice,
    branchIds: full?.branchIds ?? [],
    description: full?.description ?? null,
    longDescription: full?.longDescription ?? null,
  }
})

// Перформанс U20: Map _key → index пересчитывается одним проходом по items,
// вместо `findIndex` на каждый рендер каждого элемента (был O(n²)).
const keyToIndex = computed(() => {
  const map = new Map<string, number>()
  cart.items.forEach((i, idx) => map.set(i._key, idx))
  return map
})

function globalIndex(key: string): number {
  const idx = keyToIndex.value.get(key)
  if (idx === undefined) {
    reportError(new Error(`[pages/cart] _key not found in items: ${key}`))
    return -1
  }
  return idx
}

onMounted(async () => {
  if (hasOrdering.value) {
    try {
      branchSchedules.value = await $fetch<BranchScheduleInfo[]>('/api/branches')
    } catch (e) {
      reportError(e instanceof Error ? e : new Error('[pages/cart] failed to load branches'))
      branchLoadError.value = true
    }
  }
})

// U21: вместо `.map().join(',')` используем стабильный массив `_key` и
// диффим против предыдущего сета — чтобы не перезагружать ВСЕ resources при
// каждом изменении любой service-позиции.
let prevServiceKeys: string[] = []
// Generation counter защищает от race: пользователь удалил услугу A → добавил
// A снова → fetch1 (старый) может прийти ПОСЛЕ fetch2 → в resourcesMap попадут
// устаревшие данные. Каждый запуск watcher'а инкрементит gen, и резолв
// игнорится если за время `await` появился новый запуск.
let resourcesLoadGen = 0

watch(
  () => cart.serviceItems.map((i) => i.serviceId),
  async (ids) => {
    const gen = ++resourcesLoadGen

    if (ids.length === 0) {
      resourcesMap.value = new Map()
      prevServiceKeys = []
      return
    }
    // Дифф: загружаем только новые serviceId, остальные оставляем как есть.
    const prevSet = new Set(prevServiceKeys)
    const toLoad = ids.filter((id) => !prevSet.has(id))
    prevServiceKeys = [...ids]

    if (toLoad.length === 0) {
      // Только удаления — обрезаем resourcesMap по актуальному списку.
      const next = new Map<string, Array<{ id: string; name: string }>>()
      for (const id of ids) {
        const cached = resourcesMap.value.get(id)
        if (cached) next.set(id, cached)
      }
      resourcesMap.value = next
      return
    }

    const results = await Promise.allSettled(
      toLoad.map(async (serviceId) => ({
        serviceId,
        resources: await $fetch<Array<{ id: string; name: string }>>(
          `/api/appointments/resources?serviceId=${serviceId}`,
        ),
      })),
    )
    if (gen !== resourcesLoadGen) return
    const next = new Map(resourcesMap.value)
    for (const r of results) {
      if (r.status === 'fulfilled') {
        next.set(r.value.serviceId, r.value.resources)
      } else {
        reportError(r.reason instanceof Error ? r.reason : new Error('[pages/cart] failed to load service resources'))
      }
    }
    // Удаляем устаревшие entry (services убрали из корзины).
    const idSet = new Set(ids)
    for (const k of next.keys()) {
      if (!idSet.has(k)) next.delete(k)
    }
    resourcesMap.value = next
  },
  { immediate: true, deep: true },
)

function onRemove(index: number) {
  if (index < 0) return
  cart.remove(index)
}

function onChange(index: number, quantity: number) {
  if (index < 0) return
  cart.setQuantity(index, quantity)
}

function canEditDish(dishId: string | null): boolean {
  if (!dishId) return false
  const dish = menuStore.allDishes.find(d => d.id === dishId)
  if (!dish) return false
  const hasIngredients = dish.ingredients.length > 0
  const hasModifiers = (menuStore.dishModifiers[dishId] ?? []).length > 0
  const hasAddons = (menuStore.dishAddons[dishId] ?? []).length > 0
  return hasIngredients || hasModifiers || hasAddons
}

function onRemoveService(index: number) {
  const it = cart.items[index]
  if (it?.kind !== 'service') return
  cart.removeService(it.serviceId)
}

function onEditService(index: number) {
  const it = cart.items[index]
  if (it?.kind !== 'service') return
  editServiceItem.value = it
  showServiceModal.value = true
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cart-loading {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.cart-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @include mdl {
    grid-template-columns: 1fr 360px;
    align-items: start;
  }
}

.cart-items {
  @include flex-col;
}

.cart-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @include mdl {
    position: sticky;
    top: 80px;
  }
}

.summary-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  color: var(--color-text-secondary);
}

.summary-total {
  font-size: 22px;
  color: var(--color-text);
}

.closed-alert {
  margin-bottom: 4px;
}

.checkout-btn {
  width: 100%;
}

.service-meta {
  @include flex-row(12px);
}

.meta-price {
  color: var(--primary);
}
</style>
