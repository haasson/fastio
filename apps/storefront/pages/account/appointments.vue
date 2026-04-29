<template>
  <PageShell>
    <FsSection>
      <StorePageLayout
        :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]"
        current="Мои записи"
      >
        <div class="appts-root">
          <AccountCardsSkeleton
            v-if="loading"
            :count="3"
            :lines="[{ width: '40%', height: '18px' }, { width: '60%', height: '13px' }]"
          />

          <SfEmptyState
            v-else-if="appointments.length === 0"
            title="У вас пока нет записей"
            description="Запишитесь на услугу — она появится здесь"
          >
            <CalendarCheck :size="48" />
            <template #action>
              <FsButton variant="primary" @click="navigateTo({ path: '/appointments', query: route.query })">
                Записаться
              </FsButton>
            </template>
          </SfEmptyState>

          <div v-else class="list">
            <FsCard v-for="appt in appointments" :key="appt.id" class="appt-card">
              <div class="appt-inner">
                <div class="appt-left">
                  <div class="appt-header">
                    <span class="appt-service">{{ appt.serviceName ?? appt.dishName ?? 'Услуга' }}</span>
                    <ApptStatusBadge :status="appt.status" />
                  </div>
                  <span class="appt-meta">{{ formatDateTime(appt.startsAt) }}<template v-if="appt.resourceName"> · {{ appt.resourceName }}</template></span>
                </div>
                <FsButton
                  v-if="canCancel(appt)"
                  variant="outline"
                  size="small"
                  :loading="cancellingId === appt.id"
                  :disabled="cancellingId === appt.id"
                  class="cancel-btn"
                  @click.stop="cancelAppointment(appt.id)"
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
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import AccountCardsSkeleton from '~/components/account/AccountCardsSkeleton.vue'
import ApptStatusBadge from '~/components/appointments/ApptStatusBadge.vue'
import { useAuthStore } from '~/stores/auth'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useToast } from '~/composables/useToast'
import { reportError } from '~/utils/reportError'
import type { Appointment } from '@fastio/shared'

type ApptWithNames = Appointment & { dishName?: string | null; serviceName: string | null; resourceName: string | null }

const route = useRoute()
const authStore = useAuthStore()
const { error: showError } = useToast()
const appointments = ref<ApptWithNames[]>([])
const loading = ref(true)
const cancellingId = ref<string | null>(null)

const formatDateTime = (iso: string) => new Intl.DateTimeFormat('ru', {
  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso))

const canCancel = (appt: ApptWithNames) => {
  return appt.status === 'new' || appt.status === 'confirmed'
}

onMounted(async () => {
  await authStore.init()
  if (!authStore.isAuthenticated) {
    authStore.showLogin()
    navigateTo('/')
    return
  }
  await fetchAppointments()
})

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function fetchAppointments() {
  loading.value = true
  try {
    const headers = await getAuthHeader()
    appointments.value = await $fetch<ApptWithNames[]>('/api/customer/appointments', { headers })
  } catch (e) {
    reportError(e instanceof Error ? e : new Error('[account/appointments] failed to fetch'))
    appointments.value = []
  } finally {
    loading.value = false
  }
}

async function cancelAppointment(id: string) {
  cancellingId.value = id
  try {
    const headers = await getAuthHeader()
    await $fetch(`/api/customer/appointments/${id}/cancel`, { method: 'POST', headers })
    const appt = appointments.value.find((a) => a.id === id)
    if (appt) appt.status = 'cancelled'
  } catch (e: unknown) {
    reportError(e instanceof Error ? e : new Error('[account/appointments] failed to cancel'))
    const msg = (e as { data?: { message?: string } })?.data?.message
    showError(msg ?? 'Не удалось отменить запись')
  } finally {
    cancellingId.value = null
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.appts-root {
  max-width: 600px;
  margin: 0 auto;
}

.list {
  @include flex-col(12px);
}

.appt-card {
  padding: 0;
}

.appt-inner {
  @include flex-between(12px);
  padding: 16px;
}

.appt-left {
  @include flex-col(6px);
  min-width: 0;
}

.appt-header {
  @include flex-row(8px);
  flex-wrap: wrap;
}

.appt-service {
  @include text-caption(600);
}

.appt-meta {
  @include text-xs;
  color: var(--color-text-secondary);
}

.cancel-btn {
  flex-shrink: 0;
}
</style>
