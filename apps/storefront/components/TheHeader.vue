<template>
  <header class="header-root">
    <div class="inner">
      <div class="brand">
        <img v-if="tenant.theme.logoUrl" :src="tenant.theme.logoUrl" class="logo" :alt="tenant.name" />
        <span class="name">{{ tenant.name }}</span>
      </div>

      <div class="right">
        <a v-if="tenant.contacts.phone" :href="`tel:${tenant.contacts.phone}`" class="phone">
          📞 {{ tenant.contacts.phone }}
        </a>
        <NuxtLink class="cart-btn" to="/cart">
          🛒
          <span v-if="cartCount > 0" class="cart-count">{{ cartCount }}</span>
        </NuxtLink>
      </div>
    </div>

    <div v-if="tenant.contacts.address || tenant.workingHours" class="subheader">
      <span v-if="tenant.contacts.address">📍 {{ tenant.contacts.address }}</span>
      <span v-if="tenant.workingHours" class="hours">· {{ tenant.workingHours }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

const props = defineProps<{ tenant: Tenant }>()
const cartStore = useCartStore()
const cartCount = computed(() => cartStore.count)
</script>

<style scoped lang="scss">
@use '../../../packages/ui/src/styles/mixins/media-queries' as *;

.header-root {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.logo {
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
}

.name {
  font-size: 18px;
  font-weight: 800;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.phone {
  display: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);

  &:hover {
    text-decoration: underline;
  }

  @include mq-m {
    display: block;
  }
}

.cart-btn {
  position: relative;
  width: 44px;
  height: 44px;
  background: var(--primary-light, #fff4f0);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--primary) 20%, white);
  }
}

.cart-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--primary);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.subheader {
  max-width: 1100px;
  margin: 0 auto;
  padding: 6px 20px;
  font-size: 12px;
  color: #999;
  border-top: 1px solid #f8f8f8;
}

.hours {
  font-weight: 600;
  color: #666;
}
</style>
