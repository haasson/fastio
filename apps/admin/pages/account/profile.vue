<template>
  <div class="profile-root">
    <div class="profile-grid">
      <UiKeyValue align="stacked" label="Имя" :value="userName" />
      <UiKeyValue align="stacked" label="Email" :value="userEmail" />
      <UiKeyValue align="stacked" label="Роль" :value="roleName" />
    </div>

    <div class="logout-section">
      <UiButton
        type="default"
        icon="logOut"
        :loading="loggingOut"
        @click="handleLogout"
      >
        Выйти из аккаунта
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { navigateTo } from '#imports'
import { UiButton, UiKeyValue } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const { user } = storeToRefs(authStore)

const loggingOut = ref(false)

const userName = computed(() => user.value?.user_metadata?.full_name || '—')
const userEmail = computed(() => user.value?.email || '—')
const roleName = computed(() => tenantStore.currentRoleName ?? '—')

const handleLogout = async () => {
  const confirmed = await confirm({
    title: 'Выйти из аккаунта?',
    message: 'Вы будете перенаправлены на страницу входа',
    confirmText: 'Выйти',
    confirmType: 'error',
  })

  if (!confirmed) return

  loggingOut.value = true
  tenantStore.dispose()
  await api.auth.signOut()
  window.location.href = '/login'
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.profile-root {
  @include flex-col(var(--space-24));
  max-width: 720px;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.logout-section {
  padding-top: var(--space-8);
}
</style>
