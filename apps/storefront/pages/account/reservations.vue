<template>
  <PageShell>
    <FsSection>
      <StorePageLayout
        :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]"
        current="Мои брони"
      >
        <div class="resv-root">
          <AccountCardsSkeleton
            v-if="loading"
            :count="3"
            :lines="[{ width: '40%', height: '18px' }, { width: '60%', height: '13px' }]"
          />

          <SfEmptyState
            v-else-if="reservations.length === 0"
            title="У вас пока нет броней"
            description="Забронируйте столик — он появится здесь"
          >
            <CalendarCheck :size="48" />
            <template #action>
              <FsButton variant="primary" @click="navigateTo({ path: '/booking', query: route.query })">
                Забронировать
              </FsButton>
            </template>
          </SfEmptyState>

          <div v-else class="list">
            <FsCard v-for="r in reservations" :key="r.id" class="resv-card">
              <div class="resv-inner">
                <div class="resv-left">
                  <div class="resv-header">
                    <span class="resv-title">Бронь на {{ r.guestCount }} гост{{ pluralize(r.guestCount, 'я', 'ей', 'ей') }}</span>
                    <ReservationStatusBadge :status="r.status" />
                  </div>
                  <span class="resv-meta">{{ formatDateTime(`${r.reservedDate}T${r.reservedTime}`) }}<template v-if="r.tableName"> · {{ r.tableName }}</template></span>
                </div>
                <FsButton
                  v-if="canCancel(r)"
                  variant="outline"
                  size="small"
                  :loading="cancellingId === r.id"
                  :disabled="cancellingId === r.id"
                  class="cancel-btn"
                  @click.stop="cancelReservation(r.id)"
                >
                  Отменить
                </FsButton>
              </div>
            </FsCard>
          </div>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo, useRoute } from 'nuxt/app'
import { CalendarCheck } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import AccountCardsSkeleton from '~/features/account/components/AccountCardsSkeleton.vue'
import ReservationStatusBadge from '~/features/booking/components/ReservationStatusBadge.vue'
import { useAuthStore } from '~/features/auth'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { useToast } from '~/shared/composables/useToast'
import { reportError } from '~/shared/utils/reportError'
import type { Reservation } from '@fastio/shared'
import { formatDateTime, pluralize } from '@fastio/shared'

const route = useRoute()
const authStore = useAuthStore()
const { error: showError } = useToast()
const reservations = ref<Reservation[]>([])
const loading = ref(true)
const cancellingId = ref<string | null>(null)

// Cancellable только pending/confirmed + snapshot=true (snapshot=null → legacy
// бронь до миграции 288, для них фолбэк на live settings делает сервер; UI
// показывает кнопку оптимистично, при отказе вернётся 403).
const canCancel = (r: Reservation) => {
  if (r.status !== 'pending' && r.status !== 'confirmed') return false
  if (r.allowCancelSnapshot === false) return false

  return true
}

onMounted(async () => {
  await authStore.init()
  if (!authStore.isAuthenticated) {
    authStore.showLogin()
    navigateTo('/')

    return
  }
  await fetchReservations()
})

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function fetchReservations() {
  loading.value = true
  try {
    const headers = await getAuthHeader()

    reservations.value = await $fetch<Reservation[]>('/api/customer/reservations', { headers })
  } catch (e) {
    reportError(e instanceof Error ? e : new Error('[account/reservations] failed to fetch'))
    reservations.value = []
  } finally {
    loading.value = false
  }
}

async function cancelReservation(id: string) {
  cancellingId.value = id
  try {
    const headers = await getAuthHeader()

    await $fetch(`/api/customer/reservations/${id}/cancel`, { method: 'POST', headers })
    const r = reservations.value.find((x) => x.id === id)

    if (r) r.status = 'cancelled'
  } catch (e: unknown) {
    reportError(e instanceof Error ? e : new Error('[account/reservations] failed to cancel'))
    const msg = (e as { data?: { message?: string } })?.data?.message

    showError(msg ?? 'Не удалось отменить бронь')
  } finally {
    cancellingId.value = null
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.resv-root {
  max-width: 600px;
  margin: 0 auto;
}

.list {
  @include flex-col(12px);
}

.resv-card {
  padding: 0;
}

.resv-inner {
  @include flex-between(12px);
  padding: 16px;
}

.resv-left {
  @include flex-col(6px);
  min-width: 0;
}

.resv-header {
  @include flex-row(8px);
  flex-wrap: wrap;
}

.resv-title {
  @include text-caption(600);
}

.resv-meta {
  @include text-xs;
  color: var(--color-text-secondary);
}

.cancel-btn {
  flex-shrink: 0;
}
</style>
