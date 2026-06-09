<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Личный кабинет">

        <div class="account-root" data-testid="account-hub">
          <FsCard class="account-card" data-testid="account-card-profile" @click="navigateTo({ path: '/account/profile', query: route.query })">
            <div class="nav-item">
              <div class="nav-left">
                <UserRound :size="20" class="nav-icon" />
                <span class="nav-label">Профиль</span>
              </div>
              <ChevronRight :size="16" class="nav-chevron" />
            </div>
          </FsCard>

          <FsCard v-if="isRetail" class="account-card" data-testid="account-card-orders" @click="navigateTo({ path: '/account/orders', query: route.query })">
            <div class="nav-item">
              <div class="nav-left">
                <ClipboardList :size="20" class="nav-icon" />
                <span class="nav-label">Мои заказы</span>
              </div>
              <ChevronRight :size="16" class="nav-chevron" />
            </div>
          </FsCard>

          <FsCard v-if="isServices" class="account-card" data-testid="account-card-appointments" @click="navigateTo({ path: '/account/appointments', query: route.query })">
            <div class="nav-item">
              <div class="nav-left">
                <CalendarCheck :size="20" class="nav-icon" />
                <span class="nav-label">Мои записи</span>
              </div>
              <ChevronRight :size="16" class="nav-chevron" />
            </div>
          </FsCard>

          <FsCard v-if="showReservations" class="account-card" data-testid="account-card-reservations" @click="navigateTo({ path: '/account/reservations', query: route.query })">
            <div class="nav-item">
              <div class="nav-left">
                <CalendarCheck :size="20" class="nav-icon" />
                <span class="nav-label">Мои брони</span>
              </div>
              <ChevronRight :size="16" class="nav-chevron" />
            </div>
          </FsCard>

          <FsCard v-if="isRetail" class="account-card" data-testid="account-card-addresses" @click="navigateTo({ path: '/account/addresses', query: route.query })">
            <div class="nav-item">
              <div class="nav-left">
                <MapPin :size="20" class="nav-icon" />
                <span class="nav-label">Адреса</span>
              </div>
              <ChevronRight :size="16" class="nav-chevron" />
            </div>
          </FsCard>

          <FsButton variant="outline" block data-testid="account-logout" @click="onLogout">
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
import { UserRound, ClipboardList, MapPin, CalendarCheck, ChevronRight } from 'lucide-vue-next'
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
const showReservations = computed(() => isRetail.value && !!tenant.value?.bookingEnabled)

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
  cursor: pointer;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-icon {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.nav-label {
  font-weight: 500;
  color: var(--color-text);
}

.nav-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
