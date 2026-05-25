<template>
  <FsAlert v-if="allRed" type="error">
    Ни один филиал не выполнит заказ полностью. Уберите часть позиций или смените состав корзины.
  </FsAlert>
  <section v-else-if="visibleStatuses.length" class="cart-branch-status-root">
    <FsHeading as="h6" class="title">Готовность филиалов</FsHeading>
    <ul class="list">
      <li
        v-for="b in visibleStatuses"
        :key="b.id"
        class="row"
        :class="b.status"
      >
        <span class="dot" />
        <span class="name">{{ b.name }}</span>
        <span class="status-text">
          <template v-if="b.status === 'green'">Готовы выполнить полностью</template>
          <template v-else>Нет: {{ b.missingNames.join(', ') }}</template>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { FsAlert, FsHeading } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '../stores/cart'
import { useMenuStore } from '~/features/menu-catalog'
import { computeBranchCompat } from '../utils/branchCompat'

const cart = useCartStore()
const menu = useMenuStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')

const isUnified = computed(() => tenant.value?.branchSelectionMode !== 'per_branch')

const statuses = computed(() => {
  // Виджет имеет смысл только в режиме общего каталога — в per_branch каталог уже отфильтрован.
  if (!isUnified.value) return []
  // Только dish-позиции: услуги — отдельная ось.
  if (cart.dishItems.length === 0) return []
  // Меньше 2 филиалов — индикатор бессмыслен.
  if (menu.branchesAll.length < 2) return []
  const pureItems = cart.dishItems.filter((i) => i.dishId != null)
  if (pureItems.length === 0) return []
  const dishesById = new Map(menu.allDishes.map((d) => [d.id, d]))
  return computeBranchCompat(
    pureItems,
    dishesById,
    menu.branchesAll,
    menu.branchesAll.length,
  )
})

const allGreen = computed(
  () => statuses.value.length > 0 && statuses.value.every((s) => s.status === 'green'),
)
const allRed = computed(
  () => statuses.value.length > 0 && statuses.value.every((s) => s.status === 'red'),
)

const visibleStatuses = computed(() => {
  if (statuses.value.length === 0) return []
  if (allGreen.value) return [] // всё ок — виджет не нужен
  if (allRed.value) return [] // disaster показывается через FsAlert выше
  return statuses.value.filter((s) => s.status !== 'red')
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cart-branch-status-root {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.title {
  margin: 0 0 12px;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.row.green .dot { background: var(--color-success); }
.row.yellow .dot { background: var(--color-warning); }
.row.red .dot { background: var(--color-error); }

.name {
  font-weight: 500;
  color: var(--color-text);
}

.status-text {
  color: var(--color-text-secondary);
  font-size: 13px;
  width: 100%;

  @include md {
    width: auto;
    margin-left: auto;
  }
}
</style>
