<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Меню', to: '/' }]" current="Корзина">
        <div v-if="!cart.restored" class="cart-loading">
          <FsSpinner size="large" />
        </div>

        <SfEmptyState
          v-else-if="!cart.items.length"
          title="Корзина пуста"
          description="Добавьте блюда из нашего меню"
          size="lg"
        >
          <ShoppingCart />
          <template #action>
            <FsButton @click="navigateTo('/')">В меню</FsButton>
          </template>
        </SfEmptyState>

        <div v-else class="cart-layout">
          <div class="cart-items">
            <CartItem
              v-for="(item, i) in cart.items"
              :key="item._key ?? i"
              :item="item"
              :index="i"
              :currency="currency"
              :can-edit="canEdit(item.dishId)"
              @change="cart.setQuantity"
              @remove="cart.remove"
              @edit="openEdit"
            />
          </div>

          <div class="cart-sidebar">
            <FsAlert v-if="closedStatus" type="warning" :icon="Clock" class="closed-alert">
              Мы сейчас не работаем. Откроемся {{ closedStatus.day }} в {{ closedStatus.time }}
            </FsAlert>
            <FsAlert v-else-if="branchLoadError" type="muted" class="closed-alert">
              Не удалось проверить время работы
            </FsAlert>
            <FsCard class="summary-card">
              <div class="summary-body">
                <div class="summary-row">
                  <span class="summary-label">Итого</span>
                  <span class="summary-total">{{ cart.subtotal }} {{ currency }}</span>
                </div>
                <FsButton size="large" class="checkout-btn" :disabled="!!closedStatus" @click="navigateTo('/checkout')">
                  Перейти к оформлению
                </FsButton>
              </div>
            </FsCard>
          </div>
        </div>
      </StorePageLayout>
    </FsSection>

    <DishModal
      v-if="editState.item"
      :key="editKey"
      v-model="editState.open"
      mode="edit"
      :item="editState.item"
      :modifiers="editState.modifiers"
      :addons="editState.addons"
      :max-addons="editState.maxAddons"
      :currency="currency"
      :initial-quantity="editState.initialQuantity"
      :initial-removed-ingredients="editState.initialRemovedIngredients"
      :initial-modifiers="editState.initialModifiers"
      :initial-addon-ids="editState.initialAddonIds"
      @edit="onItemEdited"
    />
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { navigateTo, useNuxtData } from 'nuxt/app'
import { ShoppingCart, Clock } from 'lucide-vue-next'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { isOpenNow } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useCartEdit } from '~/composables/useCartEdit'
import { useCurrency } from '~/composables/useCurrency'
import PageShell from '~/components/sections/PageShell.vue'
import { FsSection, FsButton, FsSpinner, FsCard, FsAlert } from '@fastio/public-ui'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import CartItem from '~/components/cart/CartItem.vue'
import DishModal from '~/components/sf/domain/DishModal.vue'

const cart = useCartStore()
const menuStore = useMenuStore()
const currency = useCurrency()
const { editKey, editState, openEdit, onItemEdited } = useCartEdit()

const { data: tenant } = useNuxtData<Tenant>('tenant')

type BranchScheduleInfo = { id: string; workingHoursSchedule: WorkingHoursSchedule | null }
const branchSchedules = ref<BranchScheduleInfo[]>([])
const branchLoadError = ref(false)

const closedStatus = computed(() => {
  const tz = tenant.value?.timezone ?? 'Europe/Moscow'
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

onMounted(async () => {
  if (!tenant.value?.orderingEnabled) {
    await navigateTo('/', { replace: true })
    return
  }

  try {
    branchSchedules.value = await $fetch<BranchScheduleInfo[]>('/api/branches')
  } catch {
    branchLoadError.value = true
  }
})

function canEdit(dishId: string | null): boolean {
  if (!dishId) return false
  const dish = menuStore.allDishes.find(d => d.id === dishId)
  if (!dish) return false
  const hasIngredients = dish.ingredients.length > 0
  const hasModifiers = (menuStore.dishModifiers[dishId] ?? []).length > 0
  const hasAddons = (menuStore.dishAddons[dishId] ?? []).length > 0
  return hasIngredients || hasModifiers || hasAddons
}

</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cart-loading {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.cart-count {
  color: var(--color-text-secondary);
  font-weight: 400;
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

.cart-sidebar {
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
  @include text-body-sm;
  color: var(--color-text-secondary);
}

.summary-total {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.closed-alert {
  margin-bottom: 12px;
}

.checkout-btn {
  width: 100%;
}
</style>
