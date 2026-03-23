<template>
  <div class="user-card-root">
    <template v-if="isAuthenticated">
      <div class="head">
        <div class="avatar">{{ userInitial }}</div>
        <span class="name">{{ customerName || customerEmail }}</span>
      </div>
      <nav class="nav">
        <NuxtLink class="nav-link" :to="{ path: '/account/profile', query: route.query }" @click="emit('close')">Профиль</NuxtLink>
        <NuxtLink class="nav-link" :to="{ path: '/account/orders', query: route.query }" @click="emit('close')">Заказы</NuxtLink>
        <NuxtLink class="nav-link" :to="{ path: '/account/addresses', query: route.query }" @click="emit('close')">Адреса</NuxtLink>
        <button class="nav-link nav-link--logout" @click="onLogout">Выйти</button>
      </nav>
    </template>

    <button v-else class="login-btn" @click="onLogin">
      <UserRound :size="18" :stroke-width="1.7" />
      Войти в аккаунт
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'nuxt/app'
import { storeToRefs } from 'pinia'
import { UserRound } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { useConfirm } from '~/composables/useConfirm'

const emit = defineEmits<{ close: [] }>()

const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated, customerName, customerEmail } = storeToRefs(authStore)
const { confirm } = useConfirm()

const userInitial = computed(() => {
  const source = customerName.value || customerEmail.value || ''
  return source.charAt(0).toUpperCase()
})

async function onLogout() {
  const ok = await confirm('Вы уверены, что хотите выйти?', { title: 'Выход', confirmLabel: 'Выйти' })
  if (!ok) return
  emit('close')
  await authStore.logout()
}

function onLogin() {
  authStore.showLogin()
  emit('close')
}
</script>

<style scoped lang="scss">
.user-card-root {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-card, 14px);
  padding: 16px;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--on-primary, #fff);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-link {
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
  background: none;
  border: none;
  padding: 8px 4px;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;

  &:hover { color: var(--primary); }
  &.router-link-active { color: var(--primary); }

  &--logout {
    color: var(--color-danger, #e53935);
    margin-top: 4px;

    &:hover { opacity: 0.7; }
  }
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover { opacity: 0.7; }
}
</style>
