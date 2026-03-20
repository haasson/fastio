<template>
  <PageShell>
    <FsSection>
      <StorePageLayout back-to="/" back-label="Меню">
        <template #heading>
          Корзина<span v-if="cart.count" class="cart-count"> ({{ cart.count }})</span>
        </template>

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
              :can-edit="!!item.dishId"
              @change="cart.setQuantity"
              @remove="cart.remove"
              @edit="openEdit"
            />
          </div>

          <div class="cart-sidebar">
            <FsCard class="summary-card">
              <div class="summary-body">
                <div class="summary-row">
                  <span class="summary-label">Итого</span>
                  <span class="summary-total">{{ cart.subtotal }} {{ currency }}</span>
                </div>
                <FsButton size="large" class="checkout-btn" @click="navigateTo('/checkout')">
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
import { onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { ShoppingCart } from 'lucide-vue-next'
import { useCartStore } from '~/stores/cart'
import { useCartEdit } from '~/composables/useCartEdit'
import { useCurrency } from '~/composables/useCurrency'
import PageShell from '~/components/sections/PageShell.vue'
import { FsSection, FsButton, FsSpinner, FsCard } from '@fastio/public-ui'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import CartItem from '~/components/cart/CartItem.vue'
import DishModal from '~/components/sf/domain/DishModal.vue'

const cart = useCartStore()
const currency = useCurrency()
const { editKey, editState, openEdit, onItemEdited } = useCartEdit()

onMounted(() => {
  cart.restore()
})
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

  @include md {
    grid-template-columns: 1fr 360px;
    align-items: start;
  }
}

.cart-sidebar {
  @include md {
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
  font-size: 15px;
  color: var(--color-text-secondary);
}

.summary-total {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.checkout-btn {
  width: 100%;
}
</style>
