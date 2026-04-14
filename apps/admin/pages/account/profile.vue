<template>
  <div class="profile-root">
    <div class="profile-grid">
      <div><UiText size="small" class="label">Имя</UiText><UiText>{{ userName }}</UiText></div>
      <div><UiText size="small" class="label">Email</UiText><UiText>{{ userEmail }}</UiText></div>
      <div><UiText size="small" class="label">Роль</UiText><UiText>{{ roleName }}</UiText></div>
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
import { UiText, UiButton } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'

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
@use '@fastio/styles/mixins/media-queries' as *;

.profile-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.label {
  color: var(--color-text-hint);
  margin-bottom: var(--space-4);
  display: block;
}

.logout-section {
  padding-top: var(--space-8);
}
</style>
