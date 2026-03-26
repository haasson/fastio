<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Личный кабинет">

        <div class="account-root">
          <FsCard class="account-card" @click="navigateTo({ path: '/account/profile', query: route.query })">
            <UserRound :size="20" />
            <span>Профиль</span>
          </FsCard>

          <FsCard class="account-card" @click="navigateTo({ path: '/account/orders', query: route.query })">
            <ClipboardList :size="20" />
            <span>Мои заказы</span>
          </FsCard>

          <FsCard class="account-card" @click="navigateTo({ path: '/account/addresses', query: route.query })">
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
import { onMounted } from 'vue'
import { navigateTo, useRoute } from 'nuxt/app'
import { UserRound, ClipboardList, MapPin } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import { useAuthStore } from '~/stores/auth'
import { storeToRefs } from 'pinia'

const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

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
