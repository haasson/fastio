<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]" current="Мои адреса">

        <div class="addresses-root">
          <AccountCardsSkeleton
            v-if="addressesStore.loading"
            :count="2"
            :lines="[{ width: '35%', height: '16px' }, { width: '80%' }, { width: '50%', height: '13px' }]"
          />

          <SfEmptyState
            v-else-if="addresses.length === 0"
            title="Нет сохранённых адресов"
            description="Сохраните адрес, чтобы не вводить его каждый раз"
          >
            <MapPin />
            <template #action>
              <FsButton variant="primary" @click="openNew">Добавить адрес</FsButton>
            </template>
          </SfEmptyState>

          <div v-else class="list">
            <FsCard v-for="addr in addresses" :key="addr.id" class="addr-card">
              <div class="addr-inner">
                <div class="addr-header">
                  <span class="addr-label">{{ addr.label || 'Адрес' }}</span>
                </div>
                <div class="addr-text">{{ addr.address }}</div>
                <div v-if="addr.entrance || addr.floor || addr.apartment" class="addr-details">
                  <span v-if="addr.entrance">подъезд {{ addr.entrance }}</span>
                  <span v-if="addr.floor">этаж {{ addr.floor }}</span>
                  <span v-if="addr.apartment">кв. {{ addr.apartment }}</span>
                </div>
                <div class="addr-actions">
                  <FsButton size="small" variant="ghost" @click="editAddress(addr)">Изменить</FsButton>
                  <FsButton size="small" variant="ghost" @click="removeAddress(addr)">Удалить</FsButton>
                </div>
              </div>
            </FsCard>
          </div>

          <FsButton v-if="addresses.length > 0" variant="outline" @click="openNew">
            Добавить адрес
          </FsButton>
        </div>

        <AddressFormModal
          v-model="modalOpen"
          :address="editingAddress"
          @save="onSave"
        />
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { useConfirm } from '~/shared/composables/useConfirm'
import type { CustomerAddress } from '@fastio/shared'
import { MapPin } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import AccountCardsSkeleton from '~/features/account/components/AccountCardsSkeleton.vue'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import AddressFormModal from '~/features/account/components/AddressFormModal.vue'
import { useAuthStore } from '~/features/auth'
import { useAddressesStore } from '~/features/account'
import { storeToRefs } from 'pinia'

definePageMeta({ middleware: 'no-services' })

const authStore = useAuthStore()
const addressesStore = useAddressesStore()
const { confirm } = useConfirm()
const { isAuthenticated } = storeToRefs(authStore)
const { addresses } = storeToRefs(addressesStore)

const modalOpen = ref(false)
const editingAddress = ref<CustomerAddress | null>(null)

onMounted(async () => {
  await authStore.init()
  if (!isAuthenticated.value) {
    authStore.showLogin()
    navigateTo('/')
    return
  }
  await addressesStore.fetch()
})

async function removeAddress(addr: CustomerAddress) {
  const ok = await confirm(`Удалить адрес «${addr.label || addr.address}»?`, {
    title: 'Удалить адрес?',
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (ok) await addressesStore.remove(addr.id)
}

function openNew() {
  editingAddress.value = null
  modalOpen.value = true
}

function editAddress(addr: CustomerAddress) {
  editingAddress.value = addr
  modalOpen.value = true
}

async function onSave(data: Record<string, unknown>) {
  if (editingAddress.value) {
    await addressesStore.update(editingAddress.value.id, data as Partial<CustomerAddress>)
  } else {
    await addressesStore.add(data as Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>)
  }
  modalOpen.value = false
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.addresses-root {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.addr-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.addr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.addr-label {
  font-weight: 600;
}

.addr-text {
  @include text-caption;
}

.addr-details {
  @include text-xs;
  color: var(--color-text-secondary);
  display: flex;
  gap: 12px;
}

.addr-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
</style>
