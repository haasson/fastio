<template>
  <div class="no-access-root">
    <div class="card">
      <AppBrand class="brand" />

      <UiTitle size="h3" class="title">Нет доступа</UiTitle>

      <p class="message">
        Ваш аккаунт не привязан ни к одному заведению.
        Обратитесь к администратору для получения приглашения.
      </p>

      <UiButton type="primary" block @click="logout">Выйти</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta, navigateTo } from '#imports'
import { UiButton, UiTitle } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ layout: false })

const api = useDatabase()
const tenantStore = useTenantStore()

const logout = async () => {
  tenantStore.dispose()
  await api.auth.signOut()
  window.location.href = '/login'
}
</script>

<style scoped lang="scss">
.no-access-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  padding: var(--space-16);
}

.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-16);
  padding: var(--space-32) var(--space-32);
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.brand {
  margin-bottom: var(--space-32);
}

.title {
  margin: 0 0 var(--space-16);
}

.message {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
  margin: 0 0 var(--space-24);
}
</style>
