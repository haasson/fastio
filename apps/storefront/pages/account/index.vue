<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Личный кабинет">

        <div class="account-root">
          <FsCard class="account-card" @click="navigateTo({ path: '/account/profile', query: route.query })">
            <UserRound :size="20" />
            <span>Профиль</span>
          </FsCard>

          <FsCard v-if="isRetail" class="account-card" @click="navigateTo({ path: '/account/orders', query: route.query })">
            <ClipboardList :size="20" />
            <span>Мои заказы</span>
          </FsCard>

          <FsCard v-if="isServices" class="account-card" @click="navigateTo({ path: '/account/appointments', query: route.query })">
            <CalendarCheck :size="20" />
            <span>Мои записи</span>
          </FsCard>

          <FsCard v-if="isRetail" class="account-card" @click="navigateTo({ path: '/account/addresses', query: route.query })">
            <MapPin :size="20" />
            <span>Адреса</span>
          </FsCard>

          <FsButton variant="outline" block @click="onLogout">
            Выйти
          </FsButton>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { navigateTo, useNuxtData, useRoute } from 'nuxt/app'
import { UserRound, ClipboardList, MapPin, CalendarCheck } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import { useAuthStore } from '~/features/auth'
import { storeToRefs } from 'pinia'

const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
const { data: tenant } = useNuxtData<Tenant>('tenant')
const isServices = computed(() => tenant.value?.businessType === 'services')
const isRetail = computed(() => tenant.value?.businessType === 'retail')

onMounted(async () => {
  await authStore.init()
  if (!isAuthenticated.value) {
    authStore.showLogin()
    navigateTo('/')
  }
})

async function onLogout() {
  await authStore.logout()
  navigateTo('/')
}
</script>

<style scoped lang="scss">
.account-root {
  max-width: 400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-card {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-weight: 500;
}
</style>
