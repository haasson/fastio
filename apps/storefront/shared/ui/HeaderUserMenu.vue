<template>
  <div class="user-menu-root">
    <div v-if="isAuthenticated" ref="dropdownRef" class="dropdown">
      <button class="avatar" :aria-label="customerName || customerEmail || 'Аккаунт'" @click="open = !open">
        {{ userInitial }}
      </button>
      <div v-if="open" class="dropdown-menu" @click="open = false">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="dropdown-item"
          @click="onSelect(item.id)"
        >
          {{ item.label }}
        </button>
        <div class="dropdown-divider" />
        <button class="dropdown-item dropdown-item--danger" @click="onLogout">
          Выйти
        </button>
      </div>
    </div>

    <FsIconButton v-else-if="canLogin" size="small" aria-label="Войти" @click="authStore.showLogin()">
      <UserRound :size="18" :stroke-width="1.7" />
    </FsIconButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useRoute, navigateTo } from 'nuxt/app'
import { storeToRefs } from 'pinia'
import { UserRound } from 'lucide-vue-next'
import { FsIconButton } from '@fastio/public-ui'
import { useAuthStore } from '~/features/auth'
import { useConfirm } from '~/shared/composables/useConfirm'
import useCanLogin from '~/shared/composables/useCanLogin'

const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated, customerName, customerEmail } = storeToRefs(authStore)
const { confirm } = useConfirm()
const { canLogin } = useCanLogin()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
onClickOutside(dropdownRef, () => { open.value = false })

const userInitial = computed(() => {
  const source = customerName.value || customerEmail.value || ''
  return source.charAt(0).toUpperCase()
})

const navItems = [
  { id: 'profile', label: 'Профиль' },
  { id: 'orders', label: 'Мои заказы' },
  { id: 'addresses', label: 'Адреса' },
]

async function onSelect(id: string) {
  const q = route.query
  if (id === 'profile') navigateTo({ path: '/account/profile', query: q })
  else if (id === 'orders') navigateTo({ path: '/account/orders', query: q })
  else if (id === 'addresses') navigateTo({ path: '/account/addresses', query: q })
}

async function onLogout() {
  const ok = await confirm('Вы уверены, что хотите выйти?', { title: 'Выход', confirmLabel: 'Выйти' })
  if (!ok) return
  open.value = false
  await authStore.logout()
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.user-menu-root {
  display: none;

  @include lg { display: block; }
}

.dropdown {
  position: relative;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  @include text-xs(700);
  font-family: inherit;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:hover { opacity: 0.85; }
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: var(--z-dropdown);
  overflow: hidden;
  padding: 4px 0;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  @include text-caption;
  font-family: inherit;
  color: var(--color-text);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: var(--color-surface); }

  &--danger { color: var(--color-error); }
}
</style>
